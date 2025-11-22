# Voice Agent MCP Service

Live voice MCP agent service using Ollama, Whisper, and MCP tools for appointment booking.

## Overview

This service provides a **live, low-latency voice agent** that:
- Uses **local Whisper** for speech-to-text (STT)
- Uses **local Ollama** LLM for reasoning and tool calls
- Connects to your existing **MCP server** via Express API for real data
- Exposes WebSocket endpoint for real-time audio streaming

## Prerequisites

1. **Python 3.10+**
2. **Ollama** installed and running:
   ```bash
   # Install Ollama from https://ollama.ai
   # Pull a model:
   ollama pull deepseek-r1:1.5b
   # Or use a smaller model:
   ollama pull llama3.2:1b
   ```
3. **Express API** running (for MCP tools)

## Setup

1. **Install dependencies**:
   ```bash
   cd apps/voice-agent
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   # Upgrade pip, setuptools, wheel first (important for Windows)
   pip install --upgrade pip setuptools wheel
   
   # Install core dependencies
   pip install -r requirements.txt
   
   # Optional: Install faster-whisper for audio transcription
   # On Windows, you may need Rust toolchain first: https://rustup.rs/
   # pip install faster-whisper
   ```

2. **Configure environment**:
   ```bash
   # Create .env file in apps/voice-agent/
   # Required variables:
   API_BASE_URL=http://localhost:4000
   BACKEND_API_KEY=your-api-key-here  # Must match BACKEND_API_KEY in apps/api/.env
   OLLAMA_MODEL=deepseek-r1:1.5b
   OLLAMA_HOST=http://localhost:11434
   VOICE_AGENT_PORT=5007
   ```
   
   **Important**: The `BACKEND_API_KEY` must match the `BACKEND_API_KEY` set in your Express API (`apps/api/.env`). Without this, API calls to protected endpoints (availability, appointments, geocode) will fail.

3. **Start the service**:
   ```bash
   # From apps/voice-agent directory:
   python -m src.server
   # Or:
   uvicorn src.server:app --host 0.0.0.0 --port 5007 --reload
   ```

The service will be available at:
- HTTP: `http://localhost:5007`
- WebSocket: `ws://localhost:5007/ws/voice`

## Usage

### WebSocket API

Connect to `ws://localhost:5007/ws/voice` for live voice interaction:

**Send audio (binary)**:
- Stream raw audio bytes (16-bit PCM, 16kHz, mono)

**Send text (JSON)**:
```json
{
  "type": "text",
  "message": "I need a cardiologist near downtown",
  "location": {"lat": 40.7128, "lng": -74.0060}
}
```

**Receive messages**:
- `{"type": "transcript", "text": "...", "is_final": false}` - Partial transcript
- `{"type": "transcript", "text": "...", "is_final": true}` - Final transcript
- `{"type": "response", "text": "...", "tool_result": {...}}` - Agent response
- `{"type": "status", "message": "..."}` - Status updates
- `{"type": "error", "message": "..."}` - Errors

### HTTP API

**POST /chat** (text fallback):
```json
{
  "message": "Find me a dentist",
  "location": {"lat": 40.7128, "lng": -74.0060},
  "chatId": "optional-chat-id"
}
```

## Architecture

```
Client (Web/Mobile)
  ↓ WebSocket (audio stream)
Voice Agent Service
  ├─ Whisper (STT) → text
  ├─ Ollama LLM → reasoning + tool calls
  ├─ MCP Client → Express API → MCP tools
  └─ Response → Client
Client TTS (speechSynthesis / expo-speech)
```

## Configuration

See `.env.example` for all configuration options:

- `OLLAMA_HOST`: Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model to use (default: deepseek-r1:1.5b)
- `WHISPER_MODEL`: Whisper model size (tiny/base/small/medium)
- `API_BASE_URL`: Express API URL (default: http://localhost:4000)
- `VOICE_AGENT_PORT`: Server port (default: 5007)

## Troubleshooting

**Ollama connection error**:
- Ensure Ollama is running: `ollama serve`
- Check model is pulled: `ollama list`

**Whisper errors**:
- `faster-whisper` is optional - install separately if you need audio transcription
- On Windows, you may need Rust toolchain: Install from https://rustup.rs/
- Then install: `pip install faster-whisper`
- First run downloads the model (may take time)
- Use smaller model (tiny/base) for faster startup
- **Note**: Without Whisper, the service will work for text-based chat but audio streaming will be disabled

**API connection errors**:
- Ensure Express API is running: `cd apps/api && npm run dev`
- Check API is accessible: `curl http://localhost:4000/health`
- Verify `API_BASE_URL` in `.env` matches your API server URL
- **Critical**: Set `BACKEND_API_KEY` in `.env` to match `BACKEND_API_KEY` in `apps/api/.env`
- Check server logs for connection errors - they will show the exact issue
- Some endpoints require API key authentication:
  - `/availability` - requires API key
  - `/appointments/schedule` - requires API key
  - `/geocode` - requires API key
  - `/doctors/search` - public (no API key needed)

## Development

The service uses:
- **FastAPI** for HTTP/WebSocket server
- **faster-whisper** for streaming STT
- **ollama** Python client for LLM
- **httpx** for MCP tool calls

## Notes

- This is a **fully free, self-hosted** solution
- No API costs - everything runs locally
- STT and LLM run on your machine (CPU/GPU)
- TTS is handled client-side (browser/mobile)

