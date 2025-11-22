"""
Voice Agent Server - FastAPI server for live voice MCP agent
Handles WebSocket connections for real-time audio streaming
"""
import os
import asyncio
import base64
import json
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import numpy as np
try:
    from faster_whisper import WhisperModel
except ImportError:
    # Fallback if faster-whisper not available
    WhisperModel = None
try:
    from .agent import VoiceAgent
    from .mcp_client import MCPClient
except ImportError:
    # For direct execution
    from agent import VoiceAgent
    from mcp_client import MCPClient

# Load environment variables
load_dotenv()

app = FastAPI(title="Voice Agent MCP Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper model
whisper_model_name = os.getenv("WHISPER_MODEL", "base")
whisper_model = None
if WhisperModel:
    try:
        whisper_model = WhisperModel(whisper_model_name, device="cpu", compute_type="int8")
    except Exception as e:
        print(f"Warning: Could not initialize Whisper model: {e}")
        print("Audio transcription will be disabled. Install faster-whisper: pip install faster-whisper")

# Initialize voice agent
voice_agent = VoiceAgent()

# Store active connections
active_connections: Dict[str, VoiceAgent] = {}


@app.on_event("startup")
async def startup_event():
    """Test API connection on startup"""
    print("[Server] Testing API connection...")
    connected = await voice_agent.mcp_client.test_connection()
    if connected:
        print("[Server] ✓ API connection successful")
    else:
        print("[Server] ✗ API connection failed - check your configuration")


@app.get("/")
async def root():
    return {
        "service": "Voice Agent MCP Service",
        "status": "running",
        "ollama_model": os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b"),
        "whisper_model": whisper_model_name,
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/capabilities")
async def capabilities():
    """Check what capabilities are available"""
    return {
        "whisper_available": whisper_model is not None,
        "ollama_model": os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b"),
        "whisper_model": whisper_model_name if whisper_model else None,
    }


@app.websocket("/ws/voice")
async def websocket_voice(websocket: WebSocket):
    """WebSocket endpoint for live voice interaction"""
    await websocket.accept()
    connection_id = id(websocket)
    active_connections[str(connection_id)] = voice_agent
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "status",
            "message": "Connected to voice agent",
        })
        
        # Audio buffer for streaming
        audio_buffer = b""
        sample_rate = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
        chunk_size = int(os.getenv("AUDIO_CHUNK_SIZE", "4096"))
        
        while True:
            # Receive message
            try:
                data = await websocket.receive()
                print(f"[Voice Agent] Received data type: {type(data)}, keys: {data.keys() if isinstance(data, dict) else 'not a dict'}")
            except Exception as e:
                print(f"[Voice Agent] Error receiving message: {e}")
                break
            
            if "text" in data:
                # Text message (fallback or control)
                try:
                    message_data = json.loads(data["text"])
                    print(f"[Voice Agent] Parsed message data: {message_data}")
                    msg_type = message_data.get("type")
                    print(f"[Voice Agent] Message type: {msg_type}")
                except json.JSONDecodeError as e:
                    print(f"[Voice Agent] Failed to parse JSON: {e}, raw text: {data.get('text', '')[:100]}")
                    continue
                
                if msg_type == "text":
                    # Direct text input
                    user_message = message_data.get("message", "")
                    location = message_data.get("location")
                    
                    if user_message:
                        print(f"[Voice Agent] Received text message: {user_message}")
                        try:
                            result = await voice_agent.process_message(
                                user_message,
                                location
                            )
                            
                            print(f"[Voice Agent] Sending response: {result.get('response', '')[:100]}...")
                            await websocket.send_json({
                                "type": "response",
                                "text": result["response"],
                                "tool_result": result.get("tool_result"),
                            })
                        except Exception as e:
                            print(f"[Voice Agent] Error processing message: {e}")
                            import traceback
                            traceback.print_exc()
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Error processing message: {str(e)}",
                            })
                
                elif msg_type == "reset":
                    voice_agent.reset_conversation()
                    await websocket.send_json({
                        "type": "status",
                        "message": "Conversation reset",
                    })
            
            elif "bytes" in data:
                # Audio data
                print(f"[Voice Agent] Received audio data: {len(data['bytes'])} bytes")
                audio_chunk = data["bytes"]
                audio_buffer += audio_chunk
                
                # Process when buffer is large enough
                if len(audio_buffer) >= chunk_size:
                    try:
                        # Convert bytes to numpy array
                        audio_array = np.frombuffer(
                            audio_buffer[:chunk_size], 
                            dtype=np.int16
                        ).astype(np.float32) / 32768.0
                        
                        # Transcribe with Whisper (streaming mode)
                        if not whisper_model:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Whisper model not available. Please install faster-whisper.",
                            })
                            continue
                        
                        segments, info = whisper_model.transcribe(
                            audio_array,
                            language="en",
                            beam_size=5,
                            vad_filter=True,
                        )
                        
                        # Get the most recent segment
                        transcript = ""
                        for segment in segments:
                            transcript = segment.text
                        
                        if transcript.strip():
                            # Send partial transcript
                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "is_final": False,
                            })
                            
                            # Process with agent
                            result = await voice_agent.process_message(transcript)
                            
                            # Send final transcript and response
                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "is_final": True,
                            })
                            
                            await websocket.send_json({
                                "type": "response",
                                "text": result["response"],
                                "tool_result": result.get("tool_result"),
                            })
                        
                        # Clear buffer
                        audio_buffer = audio_buffer[chunk_size:]
                        
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Processing error: {str(e)}",
                        })
    
    except WebSocketDisconnect:
        print(f"[Voice Agent] WebSocket disconnected")
    except Exception as e:
        print(f"[Voice Agent] WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up connection
        if str(connection_id) in active_connections:
            del active_connections[str(connection_id)]


@app.post("/chat")
async def chat_text(request: Dict[str, Any]):
    """HTTP endpoint for text-based chat (fallback)"""
    message = request.get("message", "")
    location = request.get("location")
    chat_id = request.get("chatId")
    
    if not message:
        return {"error": "Message is required"}
    
    # Create or get agent for this chat
    agent_key = chat_id or "default"
    if agent_key not in active_connections:
        active_connections[agent_key] = VoiceAgent()
    
    agent = active_connections[agent_key]
    result = await agent.process_message(message, location)
    
    return {
        "response": result["response"],
        "tool_result": result.get("tool_result"),
        "chatId": chat_id,
    }


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("VOICE_AGENT_HOST", "0.0.0.0")
    port = int(os.getenv("VOICE_AGENT_PORT", "5007"))
    
    uvicorn.run(
        "src.server:app",
        host=host,
        port=port,
        reload=True,
    )

