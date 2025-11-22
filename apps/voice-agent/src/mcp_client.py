"""
MCP Client for connecting to the Express API endpoints
Since the MCP server runs on stdio, we'll call the Express API directly
which exposes the same functionality through HTTP endpoints.
"""
import os
import httpx
from typing import Dict, Any, Optional


class MCPClient:
    """Client for calling MCP tools via Express API"""
    
    def __init__(self):
        self.api_base_url = os.getenv("API_BASE_URL", "http://localhost:4000")
        self.api_key = os.getenv("API_KEY") or os.getenv("BACKEND_API_KEY")
        self.headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            self.headers["x-api-key"] = self.api_key
        
        print(f"[MCPClient] Initialized with API URL: {self.api_base_url}")
        if self.api_key:
            print(f"[MCPClient] API key configured (length: {len(self.api_key)})")
        else:
            print("[MCPClient] WARNING: No API key configured. Some endpoints may fail.")
    
    async def _make_request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Make an HTTP request with error handling"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                print(f"[MCPClient] {method} {url}")
                if kwargs.get("params"):
                    print(f"[MCPClient] Params: {kwargs['params']}")
                if kwargs.get("json"):
                    print(f"[MCPClient] Body: {kwargs['json']}")
                
                response = await client.request(method, url, headers=self.headers, **kwargs)
                
                print(f"[MCPClient] Response status: {response.status_code}")
                
                if response.status_code >= 400:
                    error_text = response.text[:500]  # Limit error text length
                    print(f"[MCPClient] Error response: {error_text}")
                    response.raise_for_status()
                
                return response.json()
        except httpx.ConnectError as e:
            error_msg = f"Failed to connect to API at {self.api_base_url}. Is the API server running?"
            print(f"[MCPClient] Connection error: {error_msg}")
            raise Exception(error_msg) from e
        except httpx.HTTPStatusError as e:
            error_msg = f"API request failed with status {e.response.status_code}: {e.response.text[:200]}"
            print(f"[MCPClient] HTTP error: {error_msg}")
            raise Exception(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            print(f"[MCPClient] Error: {error_msg}")
            raise Exception(error_msg) from e
    
    async def search_doctors(
        self, 
        specialty: str, 
        lat: float, 
        lng: float, 
        radius_km: float = 10
    ) -> Dict[str, Any]:
        """Search for doctors by specialty and location"""
        return await self._make_request(
            "GET",
            f"{self.api_base_url}/doctors/search",
            params={
                "specialty": specialty,
                "lat": lat,
                "lng": lng,
                "radiusKm": radius_km,
            },
        )
    
    async def check_availability(
        self,
        doctor_id: str,
        start_utc: str,
        end_utc: str,
        slot_minutes: int = 30
    ) -> Dict[str, Any]:
        """Check available time slots for a doctor"""
        return await self._make_request(
            "POST",
            f"{self.api_base_url}/availability",
            json={
                "doctorId": doctor_id,
                "startRangeUtc": start_utc,
                "endRangeUtc": end_utc,
                "slotMinutes": slot_minutes,
            },
        )
    
    async def schedule_appointment(
        self,
        doctor_id: str,
        start_utc: str,
        user: Dict[str, str],
        end_utc: Optional[str] = None,
        duration_minutes: int = 30,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        symptoms: Optional[list] = None,
    ) -> Dict[str, Any]:
        """Schedule an appointment with full details"""
        payload = {
            "doctorId": doctor_id,
            "startUtc": start_utc,
            "user": user,
        }
        if end_utc:
            payload["endUtc"] = end_utc
        if duration_minutes:
            payload["durationMinutes"] = duration_minutes
        if reason:
            payload["reason"] = reason
        if notes:
            payload["notes"] = notes
        if symptoms:
            payload["symptoms"] = symptoms
        
        return await self._make_request(
            "POST",
            f"{self.api_base_url}/appointments/schedule",
            json=payload,
        )
    
    async def geocode(self, query: str) -> Dict[str, Any]:
        """Geocode an address to coordinates"""
        return await self._make_request(
            "GET",
            f"{self.api_base_url}/geocode",
            params={"q": query},
        )
    
    async def parse_message(self, message: str) -> Dict[str, Any]:
        """Parse user message for intent and entities"""
        return await self._make_request(
            "POST",
            f"{self.api_base_url}/nlu/parse",
            json={"message": message},
        )
    
    async def test_connection(self) -> bool:
        """Test connection to the API server"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.api_base_url}/health",
                    headers=self.headers,
                )
                if response.status_code == 200:
                    print(f"[MCPClient] Successfully connected to API at {self.api_base_url}")
                    return True
                else:
                    print(f"[MCPClient] API health check returned status {response.status_code}")
                    return False
        except Exception as e:
            print(f"[MCPClient] Failed to connect to API: {e}")
            return False

