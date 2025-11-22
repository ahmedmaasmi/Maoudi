"""
Voice Agent for appointment booking using Ollama LLM and MCP tools
"""
import os
import json
import re
import ollama
from typing import Dict, Any, Optional, List

try:
    from .mcp_client import MCPClient
except ImportError:
    # For direct execution
    from mcp_client import MCPClient


class VoiceAgent:
    """Voice agent that uses Ollama LLM and MCP tools for appointment booking"""
    
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b")
        self.mcp_client = MCPClient()
        self._api_connection_tested = False
        self.context = {
            "specialty": None,
            "user_name": None,
            "user_email": None,
            "preferred_time": None,
            "last_search_results": None,
            "selected_doctor_id": None,
            "symptoms": None,
            "reason": None,
            "available_slots": None,  # Store slots from availability check
        }
        
        print(f"[Agent] Initialized with Ollama host: {self.ollama_host}, model: {self.ollama_model}")
        self.conversation_history: List[Dict[str, str]] = [
            {
                "role": "system",
                "content": """You are a helpful AI assistant for booking doctor appointments. 
You can help users:
1. Search for doctors by specialty and location
2. Check doctor availability
3. Schedule appointments

IMPORTANT RULES:
- Always use the available tools (search_doctors, check_availability, schedule_appointment) to get real data
- Never make up doctor names, locations, or availability
- When the user provides information like email, name, or time preference, extract and use it immediately
- If the user mentions a specialty (like "cardiologist", "dentist", "cardiology"), ALWAYS call search_doctors tool FIRST
- When searching, use the specialty as mentioned by the user (the system will normalize it)
- After showing search results, if the user selects a doctor AND you have their name, time, and email, IMMEDIATELY call schedule_appointment
- Don't ask for confirmation if you have all required information - just book it!
- Be conversational and helpful
- Keep responses concise for voice interaction
- When showing doctor search results, clearly list all doctors with their names, addresses, and IDs
- When booking, use the EXACT doctor ID from the search results, not the name

When you need to use a tool, respond with JSON in this format:
{
  "response": "Your conversational response to the user",
  "tool": {
    "name": "tool_name",
    "arguments": {...}
  }
}

If no tool is needed, just respond with:
{
  "response": "Your conversational response"
}

EXAMPLES:
User: "I need a cardiologist"
You: {"response": "I'll search for cardiologists near you.", "tool": {"name": "search_doctors", "arguments": {"specialty": "cardiologist"}}}

User: "book for Dr Leila Benali" (after search results shown, and you have name, time from context)
You: {"response": "I'll book your appointment with Dr. Leila Benali for tomorrow at 9:00 AM. What's your email address?", "tool": null}

User: "my email is ahmed@example.com" (after you have doctor ID, name, time)
You: {"response": "Perfect! Booking your appointment now.", "tool": {"name": "schedule_appointment", "arguments": {"doctorId": "cmi3rnrxr0003c1wf56celpxw", "startUtc": "2024-01-15T09:00:00Z", "user": {"name": "Ahmed", "email": "ahmed@example.com"}}}}

User: "can you book an appointment to me tomorrow 9:00 a.m. for cardiologist my name is Ahmed and I feel some sharp pain in my heart"
You: {"response": "I'll search for cardiologists near you, Ahmed. Then we can book your appointment for tomorrow at 9 AM.", "tool": {"name": "search_doctors", "arguments": {"specialty": "cardiologist"}}}"""
            }
        ]
    
    async def process_message(
        self, 
        message: str, 
        location: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Process a user message and return response with optional tool calls"""
        
        # First, use NLU to extract entities from the message
        nlu_result = None
        try:
            nlu_result = await self.mcp_client.parse_message(message)
            print(f"[Agent] NLU extracted: intent={nlu_result.get('intent')}, specialty={nlu_result.get('entities', {}).get('specialty')}, dateRange={nlu_result.get('entities', {}).get('dateRange')}")
            
            # Update context with extracted information
            if nlu_result.get("entities", {}).get("specialty"):
                self.context["specialty"] = nlu_result["entities"]["specialty"]
            if nlu_result.get("entities", {}).get("dateRange"):
                self.context["preferred_time"] = nlu_result["entities"]["dateRange"]
        except Exception as e:
            print(f"[Agent] NLU parsing failed: {e}")
        
        # Extract user info (name, email) from message using simple patterns
        user_info = self._extract_user_info(message)
        
        # Update context with user info
        if user_info.get("name"):
            self.context["user_name"] = user_info["name"]
        if user_info.get("email"):
            self.context["user_email"] = user_info["email"]
        if user_info.get("symptoms"):
            self.context["symptoms"] = user_info["symptoms"]
        if user_info.get("reason"):
            self.context["reason"] = user_info["reason"]
        
        # Try to match doctor name if user mentions one and we have search results
        if self.context.get("last_search_results"):
            matched_doctor_id = self._match_doctor_name(message, self.context["last_search_results"])
            if matched_doctor_id:
                self.context["selected_doctor_id"] = matched_doctor_id
                print(f"[Agent] Selected doctor ID from message: {matched_doctor_id}")
        
        # Try to parse slot selection if we have available slots
        if self.context.get("available_slots"):
            slot_number = self._parse_slot_selection(message)
            if slot_number is not None and 1 <= slot_number <= len(self.context["available_slots"]):
                selected_slot = self.context["available_slots"][slot_number - 1]
                slot_start = selected_slot.get("start", "")
                slot_end = selected_slot.get("end", "")
                
                # Update preferred time with selected slot
                self.context["preferred_time"] = {
                    "start": slot_start,
                    "end": slot_end
                }
                print(f"[Agent] Selected slot {slot_number}: {slot_start} - {slot_end}")
        
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": message
        })
        
        # Get LLM response
        try:
            print(f"[Agent] Calling Ollama with model: {self.ollama_model}")
            print(f"[Agent] Message history length: {len(self.conversation_history)}")
            
            # Use the ollama module's chat function directly
            response = ollama.chat(
                model=self.ollama_model,
                messages=self.conversation_history,
                options={
                    "temperature": 0.7,
                    "num_predict": 500,  # Limit response length for voice
                }
            )
            
            print(f"[Agent] Ollama response received")
            assistant_message = response["message"]["content"]
            # Print first 200 chars safely (avoid Unicode issues)
            try:
                print(f"[Agent] Response content: {assistant_message[:200]}...")
            except UnicodeEncodeError:
                print(f"[Agent] Response received (length: {len(assistant_message)})")
            
            # Try to parse tool call from response
            tool_result = None
            try:
                # Look for JSON in the response
                json_match = None
                if "{" in assistant_message and "}" in assistant_message:
                    start = assistant_message.find("{")
                    end = assistant_message.rfind("}") + 1
                    json_str = assistant_message[start:end]
                    parsed = json.loads(json_str)
                    
                    if "tool" in parsed:
                        # Enhance tool arguments with NLU results
                        tool_call = parsed["tool"]
                        args = tool_call.get("arguments", {})
                        
                        # Use NLU-extracted specialty if not in tool call
                        if tool_call.get("name") == "search_doctors" and not args.get("specialty"):
                            if nlu_result and nlu_result.get("entities", {}).get("specialty"):
                                args["specialty"] = nlu_result["entities"]["specialty"]
                                print(f"[Agent] Using NLU-extracted specialty: {args['specialty']}")
                        
                        tool_result = await self._execute_tool(
                            tool_call, 
                            location,
                            nlu_result,
                            user_info
                        )
                        # Update response with tool result context
                        assistant_message = parsed.get("response", assistant_message)
                        if tool_result:
                            if tool_result.get("error"):
                                assistant_message = f"{assistant_message}\n\nError: {tool_result.get('error')}"
                            else:
                                assistant_message = f"{assistant_message}\n\n{tool_result.get('summary', '')}"
            except (json.JSONDecodeError, KeyError) as e:
                # Not a tool call, just a regular response
                print(f"[Agent] No tool call detected: {e}")
                # But if NLU detected a search intent or context has specialty, try to search anyway
                specialty = None
                if nlu_result and nlu_result.get("intent") == "search_doctors":
                    specialty = nlu_result.get("entities", {}).get("specialty")
                elif self.context.get("specialty"):
                    specialty = self.context["specialty"]
                    print(f"[Agent] Using context specialty: {specialty}")
                
                # Also check if user is saying they already provided info
                lower_message = message.lower()
                if (specialty or self.context.get("specialty")) and location:
                    if any(phrase in lower_message for phrase in ["i gave", "i told", "already told", "i said", "you have"]):
                        specialty = specialty or self.context.get("specialty")
                        print(f"[Agent] Auto-searching for {specialty} based on user saying they provided info")
                        tool_result = await self._execute_tool(
                            {"name": "search_doctors", "arguments": {"specialty": specialty}},
                            location,
                            nlu_result,
                            user_info
                        )
                        if tool_result and not tool_result.get("error"):
                            assistant_message = f"{assistant_message}\n\n{tool_result.get('summary', '')}"
                elif specialty and location:
                    print(f"[Agent] Auto-searching for {specialty} based on NLU intent")
                    tool_result = await self._execute_tool(
                        {"name": "search_doctors", "arguments": {"specialty": specialty}},
                        location,
                        nlu_result,
                        user_info
                    )
                    if tool_result and not tool_result.get("error"):
                        assistant_message = f"{assistant_message}\n\n{tool_result.get('summary', '')}"
            
            # After processing, check if user selected a slot number
            # If user selected a slot and we have all info, book immediately
            if (self.context.get("available_slots") and 
                self.context.get("selected_doctor_id") and 
                self.context.get("user_name") and 
                self.context.get("user_email") and
                not tool_result):
                
                slot_number = self._parse_slot_selection(message)
                if slot_number is not None and 1 <= slot_number <= len(self.context["available_slots"]):
                    selected_slot = self.context["available_slots"][slot_number - 1]
                    slot_start = selected_slot.get("start", "")
                    slot_end = selected_slot.get("end", "")
                    
                    # Update preferred time with selected slot
                    self.context["preferred_time"] = {
                        "start": slot_start,
                        "end": slot_end
                    }
                    print(f"[Agent] User selected slot {slot_number}, booking now")
                    
                    booking_result = await self._execute_tool(
                        {
                            "name": "schedule_appointment",
                            "arguments": {
                                "doctorId": self.context["selected_doctor_id"],
                                "startUtc": slot_start,
                                "user": {
                                    "name": self.context["user_name"],
                                    "email": self.context["user_email"],
                                },
                                "reason": self.context.get("reason"),
                                "symptoms": [self.context["symptoms"]] if self.context.get("symptoms") else None,
                            }
                        },
                        location,
                        nlu_result,
                        user_info
                    )
                    if booking_result and not booking_result.get("error"):
                        assistant_message = f"Perfect! Booking slot {slot_number} for you.\n\n{booking_result.get('summary', '')}"
                        tool_result = booking_result
                        # Clear slots after booking
                        self.context["available_slots"] = None
                    elif booking_result and booking_result.get("error"):
                        assistant_message = f"{assistant_message}\n\nError: {booking_result.get('error')}"
            
            # After processing, check if we should auto-book
            # If user selected a doctor and we have name, time, and email -> try to book
            if (self.context.get("selected_doctor_id") and 
                self.context.get("user_name") and 
                self.context.get("preferred_time") and 
                self.context.get("user_email") and
                not tool_result):
                
                # Check if user is confirming or providing final info (or just provided email)
                lower_message = message.lower()
                should_book = (
                    any(phrase in lower_message for phrase in ["yes", "book", "schedule", "confirm", "proceed", "ok", "okay", "go ahead", "do it", "book the appointment"]) or
                    user_info.get("email")  # User just provided email
                )
                
                if should_book:  # Only if we didn't just execute a tool
                    print("[Agent] Auto-booking appointment with all available information")
                    booking_result = await self._execute_tool(
                        {
                            "name": "schedule_appointment",
                            "arguments": {
                                "doctorId": self.context["selected_doctor_id"],
                                "startUtc": self.context["preferred_time"]["start"],
                                "user": {
                                    "name": self.context["user_name"],
                                    "email": self.context["user_email"],
                                },
                                "reason": self.context.get("reason"),
                                "symptoms": [self.context["symptoms"]] if self.context.get("symptoms") else None,
                            }
                        },
                        location,
                        nlu_result,
                        user_info
                    )
                    if booking_result and not booking_result.get("error"):
                        assistant_message = f"{assistant_message}\n\n{booking_result.get('summary', '')}"
                        tool_result = booking_result
                    elif booking_result and booking_result.get("error"):
                        assistant_message = f"{assistant_message}\n\nError: {booking_result.get('error')}"
            
            # Add assistant response to history
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })
            
            return {
                "response": assistant_message,
                "tool_result": tool_result,
            }
            
        except Exception as e:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            self.conversation_history.append({
                "role": "assistant",
                "content": error_msg
            })
            return {
                "response": error_msg,
                "error": str(e)
            }
    
    def _extract_user_info(self, message: str) -> Dict[str, Optional[str]]:
        """Extract user information (name, email, symptoms, reason) from message"""
        user_info = {"name": None, "email": None, "symptoms": None, "reason": None}
        
        # Extract name patterns: "my name is X", "I'm X", "I am X", "name is X"
        name_patterns = [
            r"my name is ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"i'?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"i am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
            r"call me\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                user_info["name"] = match.group(1).strip()
                print(f"[Agent] Extracted name: {user_info['name']}")
                break
        
        # Extract email
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        email_match = re.search(email_pattern, message)
        if email_match:
            user_info["email"] = email_match.group(0)
            print(f"[Agent] Extracted email: {user_info['email']}")
        
        # Extract symptoms/reason (look for phrases like "I feel", "I have", "symptoms", "pain")
        symptom_patterns = [
            r"i feel\s+(.+?)(?:\.|$|and|my)",
            r"i have\s+(.+?)(?:\.|$|and|my)",
            r"symptoms?\s+(?:are|is|:)\s+(.+?)(?:\.|$|and|my)",
            r"pain\s+(?:in|at)\s+(.+?)(?:\.|$|and|my)",
        ]
        
        for pattern in symptom_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                symptoms_text = match.group(1).strip()
                # Clean up the symptoms text
                symptoms_text = re.sub(r'\s+', ' ', symptoms_text)
                user_info["symptoms"] = symptoms_text
                user_info["reason"] = f"Patient reports: {symptoms_text}"
                print(f"[Agent] Extracted symptoms/reason: {user_info['symptoms']}")
                break
        
        return user_info
    
    def _parse_slot_selection(self, message: str) -> Optional[int]:
        """Parse slot selection from message (e.g., "one", "1", "first", "slot 2")"""
        lower_message = message.lower().strip()
        
        # Number words to numbers
        number_words = {
            "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
            "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
        }
        
        # Check for number words
        for word, num in number_words.items():
            if word in lower_message:
                return num
        
        # Check for digits
        import re
        digit_match = re.search(r'\b(\d+)\b', lower_message)
        if digit_match:
            return int(digit_match.group(1))
        
        return None
    
    def _match_doctor_name(self, message: str, doctors: List[Dict[str, Any]]) -> Optional[str]:
        """Match doctor name from user message to doctor list, return doctor ID"""
        if not doctors:
            return None
        
        lower_message = message.lower()
        
        for doctor in doctors:
            doctor_name = doctor.get("name", "").lower()
            # Remove "Dr." or "Dr" prefix for matching
            name_without_prefix = re.sub(r"^dr\.?\s*", "", doctor_name, flags=re.IGNORECASE)
            parts = name_without_prefix.split()
            
            if not parts:
                continue
            
            first_name = parts[0] if parts else ""
            last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
            
            # Check various matching patterns
            if (lower_message in doctor_name or 
                doctor_name in lower_message or
                lower_message in name_without_prefix or
                name_without_prefix in lower_message or
                (first_name and first_name in lower_message) or
                (last_name and last_name in lower_message)):
                doctor_id = doctor.get("id")
                print(f"[Agent] Matched doctor: {doctor.get('name')} (ID: {doctor_id})")
                return doctor_id
        
        return None
    
    async def _execute_tool(
        self, 
        tool_call: Dict[str, Any], 
        location: Optional[Dict[str, float]] = None,
        nlu_result: Optional[Dict[str, Any]] = None,
        user_info: Optional[Dict[str, Optional[str]]] = None
    ) -> Optional[Dict[str, Any]]:
        """Execute an MCP tool call"""
        # Test API connection on first tool call
        if not self._api_connection_tested:
            connected = await self.mcp_client.test_connection()
            self._api_connection_tested = True
            if not connected:
                return {
                    "error": "Could not connect to API server. Please ensure:\n1. API server is running\n2. API_BASE_URL is set correctly\n3. BACKEND_API_KEY is set if required"
                }
        
        tool_name = tool_call.get("name")
        args = tool_call.get("arguments", {})
        
        try:
            if tool_name == "search_doctors":
                # Get specialty from args, NLU result, or error
                specialty = args.get("specialty")
                if not specialty and nlu_result:
                    specialty = nlu_result.get("entities", {}).get("specialty")
                
                if not specialty:
                    # Try to extract from message context
                    return {"error": "Specialty is required. Please specify what type of doctor you're looking for (e.g., cardiologist, dentist)."}
                
                # Use provided location or ask for it
                if not location and not args.get("near"):
                    return {"error": "Location is required. Please provide coordinates or enable location access."}
                
                near = args.get("near") or location
                if not near:
                    return {"error": "Location is required"}
                
                print(f"[Agent] Searching for {specialty} doctors near {near}")
                result = await self.mcp_client.search_doctors(
                    specialty=specialty,
                    lat=near.get("lat") or near.get("latitude"),
                    lng=near.get("lng") or near.get("longitude"),
                    radius_km=args.get("radiusKm", 10)
                )
                
                doctors = result.get("doctors", [])
                if doctors:
                    summary = f"I found {len(doctors)} doctor(s) matching your search:\n\n"
                    for i, doc in enumerate(doctors[:10], 1):  # Show up to 10 doctors
                        doc_id = doc.get('id', '')
                        doc_name = doc.get('name', 'Unknown')
                        doc_specialty = doc.get('specialty', 'General Practice')
                        summary += f"{i}. **{doc_name}** - {doc_specialty}\n"
                        if doc.get('address'):
                            summary += f"   📍 {doc.get('address')}\n"
                        if doc.get('distance') is not None:
                            summary += f"   📏 {doc.get('distance'):.1f} km away\n"
                        if doc.get('phone'):
                            summary += f"   📞 {doc.get('phone')}\n"
                        if doc_id:
                            summary += f"   🆔 ID: {doc_id}\n"
                        summary += "\n"
                    if len(doctors) > 10:
                        summary += f"... and {len(doctors) - 10} more doctors.\n"
                    summary += "\nWould you like to book an appointment with one of these doctors? Just let me know which doctor and your preferred time."
                else:
                    summary = f"I couldn't find any {specialty} doctors in your area within the search radius. Try:\n- Expanding your search radius\n- Checking a different specialty\n- Or specify a different location"
                
                # Store search results in context
                self.context["last_search_results"] = doctors
                
                return {
                    "tool": "search_doctors",
                    "result": result,
                    "summary": summary
                }
            
            elif tool_name == "check_availability":
                # Use context if not provided in args
                doctor_id = args.get("doctorId") or self.context.get("selected_doctor_id")
                start_utc = args.get("startUtc")
                end_utc = args.get("endUtc")
                
                # If we have preferred time in context, use it
                if not start_utc and self.context.get("preferred_time"):
                    preferred = self.context["preferred_time"]
                    start_utc = preferred.get("start")
                    # Default to 1 day range if end not specified
                    if not end_utc:
                        from datetime import datetime, timedelta
                        start_dt = datetime.fromisoformat(start_utc.replace('Z', '+00:00'))
                        end_dt = start_dt + timedelta(days=1)
                        end_utc = end_dt.isoformat().replace('+00:00', 'Z')
                
                if not doctor_id:
                    return {"error": "Please select a doctor first. I can show you available doctors if you'd like."}
                if not start_utc:
                    return {"error": "Please specify when you'd like to check availability (e.g., tomorrow at 9 AM)."}
                if not end_utc:
                    # Default to 1 day range
                    from datetime import datetime, timedelta
                    start_dt = datetime.fromisoformat(start_utc.replace('Z', '+00:00'))
                    end_dt = start_dt + timedelta(days=1)
                    end_utc = end_dt.isoformat().replace('+00:00', 'Z')
                
                print(f"[Agent] Checking availability for doctor {doctor_id} from {start_utc} to {end_utc}")
                result = await self.mcp_client.check_availability(
                    doctor_id=doctor_id,
                    start_utc=start_utc,
                    end_utc=end_utc,
                    slot_minutes=args.get("slotMinutes", 30)
                )
                
                slots = result.get("slots", [])
                # Store slots in context for slot selection
                self.context["available_slots"] = slots
                
                if slots:
                    summary = f"I found {len(slots)} available time slot(s):\n\n"
                    # Show first 10 available slots
                    for i, slot in enumerate(slots[:10], 1):
                        start_time = slot.get("start", "")
                        end_time = slot.get("end", "")
                        # Format time nicely
                        try:
                            from datetime import datetime
                            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                            start_str = start_dt.strftime("%A, %B %d at %I:%M %p")
                            end_str = end_dt.strftime("%I:%M %p")
                            summary += f"{i}. {start_str} - {end_str}\n"
                        except:
                            summary += f"{i}. {start_time} - {end_time}\n"
                    if len(slots) > 10:
                        summary += f"\n... and {len(slots) - 10} more slots available.\n"
                    summary += "\nWhich slot would you like to book? Just say the number (e.g., 'one', '1', 'first')."
                else:
                    summary = f"No available slots found in that time range. Would you like to check a different time?"
                    self.context["available_slots"] = None
                
                return {
                    "tool": "check_availability",
                    "result": result,
                    "summary": summary
                }
            
            elif tool_name == "schedule_appointment":
                doctor_id = args.get("doctorId") or self.context.get("selected_doctor_id")
                start_utc = args.get("startUtc")
                user = args.get("user")
                
                # Use NLU-extracted date range if startUtc not provided
                if not start_utc:
                    if nlu_result and nlu_result.get("entities", {}).get("dateRange"):
                        date_range = nlu_result["entities"]["dateRange"]
                        start_utc = date_range.get("start")
                        print(f"[Agent] Using NLU-extracted start time: {start_utc}")
                    elif self.context.get("preferred_time"):
                        start_utc = self.context["preferred_time"].get("start")
                        print(f"[Agent] Using context preferred time: {start_utc}")
                
                # If doctor_id is from context, make sure we have it
                if not doctor_id:
                    # Try to get from last search results if user mentioned a name
                    if self.context.get("last_search_results"):
                        # This should have been set by _match_doctor_name, but double-check
                        pass
                
                # Build user object from args, user_info, context, or error
                if not user:
                    user = {}
                if not user.get("name"):
                    if user_info and user_info.get("name"):
                        user["name"] = user_info["name"]
                    elif self.context.get("user_name"):
                        user["name"] = self.context["user_name"]
                if not user.get("email"):
                    if user_info and user_info.get("email"):
                        user["email"] = user_info["email"]
                    elif self.context.get("user_email"):
                        user["email"] = self.context["user_email"]
                
                if not doctor_id:
                    return {"error": "Please specify which doctor you'd like to book with. I can show you available doctors if you'd like."}
                if not start_utc:
                    return {"error": "Please specify when you'd like the appointment (e.g., tomorrow at 9 AM)."}
                if not user.get("name"):
                    return {"error": "Please provide your name."}
                if not user.get("email"):
                    return {"error": "Please provide your email address."}
                
                result = await self.mcp_client.schedule_appointment(
                    doctor_id=doctor_id,
                    start_utc=start_utc,
                    user=user,
                    end_utc=args.get("endUtc"),
                    duration_minutes=args.get("durationMinutes", 30),
                    reason=args.get("reason") or self.context.get("reason"),
                    notes=args.get("notes"),
                    symptoms=args.get("symptoms") or ([self.context["symptoms"]] if self.context.get("symptoms") else None),
                )
                
                summary = f"✅ Appointment scheduled successfully!\n\n"
                summary += f"📋 Appointment ID: {result.get('appointmentId')}\n"
                if result.get("calendarLink"):
                    summary += f"📅 Calendar link: {result.get('calendarLink')}\n"
                
                return {
                    "tool": "schedule_appointment",
                    "result": result,
                    "summary": summary
                }
            
            elif tool_name == "geocode":
                query = args.get("query") or args.get("q")
                if not query:
                    return {"error": "Location query is required"}
                
                result = await self.mcp_client.geocode(query)
                return {
                    "tool": "geocode",
                    "result": result,
                    "summary": f"Found location: {result.get('display_name', query)}"
                }
            
            else:
                return {"error": f"Unknown tool: {tool_name}"}
                
        except Exception as e:
            return {"error": f"Tool execution failed: {str(e)}"}
    
    def reset_conversation(self):
        """Reset conversation history and context"""
        self.conversation_history = [
            {
                "role": "system",
                "content": """You are a helpful AI assistant for booking doctor appointments."""
            }
        ]
        self.context = {
            "specialty": None,
            "user_name": None,
            "user_email": None,
            "preferred_time": None,
            "last_search_results": None,
            "selected_doctor_id": None,
            "symptoms": None,
            "reason": None,
            "available_slots": None,
        }

