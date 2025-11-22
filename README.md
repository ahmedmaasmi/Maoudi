# Voice Appointment Booking System

A full-stack appointment booking application with voice and text interfaces, powered by Next.js, Express.js, and Model Context Protocol (MCP). Users can book appointments with doctors by speaking or typing their requirements, and the system automatically checks Google Calendar availability and schedules appointments.

## 🎯 Use Cases

### Primary Use Cases

1. **Voice-Based Appointment Booking**
   - Patients can book medical appointments using natural voice commands
   - Hands-free booking for users with accessibility needs or busy schedules
   - Conversational interface that understands natural language requests

2. **Location-Based Doctor Search**
   - Find nearby doctors based on specialty and geographic proximity
   - Automatic geocoding of addresses and location queries
   - Distance-based ranking of available healthcare providers

3. **Real-Time Availability Checking**
   - Integration with Google Calendar to check doctor availability in real-time
   - Automatic slot detection and suggestion
   - Prevents double-booking and scheduling conflicts

4. **Multi-Modal Booking Interface**
   - Voice input for hands-free operation
   - Text input for users who prefer typing
   - Form-based booking for structured data entry

5. **AI-Powered Natural Language Understanding**
   - Parses complex appointment requests from natural language
   - Extracts entities: specialty, location, date/time, urgency
   - Handles conversational context and follow-up questions

6. **Calendar Integration**
   - Automatic creation of Google Calendar events upon booking
   - OAuth-based secure access to doctor calendars
   - Synchronized scheduling across platforms
   - Multi-platform calendar support: Google Calendar, Outlook, Apple Calendar
   - iCal (.ics) file export for universal calendar compatibility
   - Enhanced event details including doctor info, patient details, reason, and symptoms

7. **Smart Chat Management**
   - Automatic chat title updates with doctor names when appointments are booked
   - Chat history persistence across sessions
   - Multiple concurrent chat sessions support
   - Auto-refresh of chat list when titles change

## 🏗️ Architecture

This is a monorepo containing:
- **Web Frontend** (`apps/web`): Next.js 14 with Tailwind CSS and Web Speech API
- **Backend API** (`apps/api`): Express.js with TypeScript, Prisma, and Google Calendar integration
- **MCP Server** (`apps/mcp`): Model Context Protocol server exposing booking tools
- **Voice Agent Service** (`apps/voice-agent`): Live voice MCP agent using Ollama, Whisper, and MCP tools (Python)
- **Mobile App** (`apps/mobile`): Expo React Native app (placeholder)
- **Shared Package** (`packages/shared`): Common types and schemas

## 🚀 Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **Tailwind CSS** for styling
- **Web Speech API** for voice input/output (free, browser-native)

### Backend
- **Node.js 20** + **Express.js** + **TypeScript**
- **Prisma** + **SQLite** for database
- **Local Calendar Service** (database-based scheduling with calendar link generation)
- **Google Calendar API** (OAuth per doctor, optional)
- **chrono-node** for date parsing
- **geolib** for distance calculations
- **Nominatim** (OpenStreetMap) for geocoding
- **iCal generation** for universal calendar export

### MCP
- **@modelcontextprotocol/sdk** for MCP server implementation

### Mobile (Future)
- **Expo** + **React Native**
- **expo-speech** for TTS
- **react-native-voice** for STT

### Live Voice MCP Agent (Free Stack)
- **FastAPI** for HTTP/WebSocket server
- **Ollama** for local LLM (free, self-hosted)
- **faster-whisper** for streaming speech-to-text
- **MCP Client** for connecting to existing MCP tools
- **WebSocket** for real-time audio streaming
- **Client-side TTS** (browser `speechSynthesis` / mobile `expo-speech`)

## 📋 Prerequisites

- **Node.js 20+**
- **pnpm 9+** (package manager)
- **Python 3.10+** (for voice agent service)
- **Google Cloud Console** account (for OAuth credentials, optional)
- **Ollama** (for live voice agent - see setup below)

## 🛠️ Setup

### 1. Clone and Install

```bash
# Install dependencies for all workspaces
pnpm install
```

### 2. Google OAuth Setup (Optional)

> **Note**: The system uses a local calendar service by default, so Google OAuth is optional. Calendar links (Google, Outlook, Apple) are generated automatically without requiring OAuth.

If you want to integrate with Google Calendar API for real-time calendar sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Calendar API**
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:4000/auth/google/callback`
6. Copy Client ID and Client Secret

### 3. Environment Variables

Create `.env` files in each app directory:

#### Root `.env` (optional, for shared values)
```env
# Shared configuration
```

#### `apps/api/.env`
```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL="file:./dev.db"

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=http://localhost:4000/auth/google/callback

# Security
BACKEND_API_KEY=your_secret_api_key_here
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_char_encryption_key_here

# Optional: AI/LLM (OpenRouter API)
# Get your API key from: https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Rate Limiting
NOMINATIM_RATE_LIMIT_PER_MINUTE=1
GEOCODE_CACHE_TTL_SECONDS=3600

# CORS
ALLOWED_ORIGINS=http://localhost:3000,exp://*,http://localhost:5005
```

#### `apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ENABLE_VOICE=true

# Eleven Labs TTS (Optional - for high-quality voice synthesis)
# Get your API key from: https://elevenlabs.io/
# Free tier includes 10,000 characters/month
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

#### `apps/mcp/.env`
```env
API_BASE_URL=http://localhost:4000
API_KEY=your_secret_api_key_here
```

### 4. Database Setup

```bash
# Run Prisma migrations
pnpm prisma:migrate

# Seed the database with sample data (doctors, patients, appointments, chats)
# This will populate the database with all the data from the current database
pnpm prisma:seed
```

**Note**: The seed file (`apps/api/prisma/seed.ts`) contains all the data from the current database, including:
- 33 doctors across various specialties
- 8 patients with their symptoms
- 25 sample appointments (past and future)
- Sample chat conversations

When you clone the repository on another PC, running `pnpm prisma:seed` will populate the database with the same initial data, ensuring a consistent development experience across different machines.

### 5. Start Development Servers

```bash
# Start all apps in parallel (API, Web, MCP)
pnpm dev

# Or start individually:
pnpm --filter @voice-appointment/api dev    # Backend on :4000
pnpm --filter @voice-appointment/web dev    # Frontend on :3000
pnpm --filter @voice-appointment/mcp dev    # MCP server on :5005
```

For mobile:
```bash
pnpm --filter @voice-appointment/mobile start
```

### 6. Live Voice MCP Agent Setup (Optional - Free Stack)

The live voice MCP agent provides **real-time, low-latency voice interaction** using only free, self-hosted components:

**Prerequisites:**
1. **Install Ollama**:
   ```bash
   # Download from https://ollama.ai or:
   # macOS/Linux:
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Pull a model (small, fast model recommended):
   ollama pull deepseek-r1:1.5b
   # Or use even smaller:
   ollama pull llama3.2:1b
   ```

2. **Set up Voice Agent Service**:
   ```bash
   cd apps/voice-agent

   # Create a virtual environment (if you don't have one already)
   python -m venv venv

   # Activate the virtual environment:
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
   # Install dependencies
   pip install -r requirements.txt
   
   # Configure environment
   cp .env.example .env
   # Edit .env with your settings (API_BASE_URL, API_KEY, etc.)
   ```

3. **Start Voice Agent Service**:
   ```bash
   # From apps/voice-agent directory:
   python -m src.server
   # Or:
   uvicorn src.server:app --host 0.0.0.0 --port 5007 --reload
   ```

4. **Enable in Web/Mobile Clients**:
   - **Web**: Toggle "Live Agent" button in VoiceChat component
   - **Mobile**: Toggle "Live Agent (MCP)" button in app header
   - Or set environment variable: `NEXT_PUBLIC_VOICE_AGENT_URL=http://localhost:5007`

**How it works:**
- **STT**: Local Whisper model processes audio streams
- **LLM**: Local Ollama model handles reasoning and tool calls
- **MCP Tools**: Connects to your existing `apps/mcp` server via Express API
- **TTS**: Client-side (browser/mobile) - no server TTS needed
- **WebSocket**: Real-time audio streaming for low latency

**Benefits:**
- ✅ **100% Free** - No API costs, everything runs locally
- ✅ **Low Latency** - Real-time voice interaction
- ✅ **Privacy** - All processing happens on your machine
- ✅ **MCP Integration** - Uses your existing MCP tools seamlessly

See `apps/voice-agent/README.md` for detailed documentation.

## 📁 Project Structure

```
.
├── apps/
│   ├── api/              # Express.js backend
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   └── index.ts
│   │   └── prisma/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App Router pages
│   │   └── components/   # React components
│   ├── mcp/              # MCP server
│   │   └── src/
│   │       └── index.ts  # MCP tools definition
│   ├── voice-agent/      # Live voice MCP agent (Python)
│   │   ├── src/
│   │   │   ├── agent.py  # Voice agent with Ollama + MCP
│   │   │   ├── server.py # FastAPI WebSocket server
│   │   │   └── mcp_client.py # MCP client
│   │   └── requirements.txt
│   └── mobile/           # Expo React Native
│       └── src/
├── packages/
│   └── shared/           # Shared types & schemas
│       └── src/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 🔌 API Endpoints

### Authentication
- `GET /auth/google/initiate?doctorId=...` - Start Google OAuth flow with state token
- `GET /auth/google/callback?code=...&state=...&doctorId=...` - OAuth callback handler
- `GET /auth/google/refresh?doctorId=...` - Refresh expired access token

### Doctors
- `GET /doctors/search?specialty=&lat=&lng=&radiusKm=10` - Find nearest doctors

### Availability
- `POST /availability` - Check free time slots
  ```json
  {
    "doctorId": "string",
    "startRangeUtc": "ISO8601",
    "endRangeUtc": "ISO8601",
    "slotMinutes": 30
  }
  ```

### Appointments
- `POST /appointments/book` - Book an appointment
  ```json
  {
    "doctorId": "string",
    "startUtc": "ISO8601",
    "endUtc": "ISO8601",
    "user": {
      "name": "string",
      "email": "string",
      "phone": "string (optional)"
    }
  }
  ```
  Returns calendar links:
  ```json
  {
    "appointmentId": "string",
    "calendarLink": "/appointments/...",
    "googleCalendarLink": "https://calendar.google.com/...",
    "outlookCalendarLink": "https://outlook.live.com/...",
    "appleCalendarLink": "data:text/calendar;...",
    "icalContent": "BEGIN:VCALENDAR..."
  }
  ```
- `POST /appointments/schedule` - Schedule appointment with full details (reason, symptoms, notes)
  ```json
  {
    "doctorId": "string",
    "startUtc": "ISO8601",
    "endUtc": "ISO8601",
    "user": {
      "name": "string",
      "email": "string",
      "phone": "string (optional)"
    },
    "reason": "string (optional)",
    "symptoms": ["string"],
    "notes": "string (optional)"
  }
  ```
- `GET /appointments` - List appointments (filterable by status, email)
- `GET /appointments/:id` - Get appointment details
- `DELETE /appointments/:id` - Cancel appointment

### Chat
- `POST /chat` - Send a message in a chat (creates new chat if no chatId provided)
  ```json
  {
    "message": "I need a dermatologist in New York",
    "chatId": "optional-chat-id",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    }
  }
  ```
  Returns:
  ```json
  {
    "chatId": "chat-id",
    "response": "AI response text",
    "action": "schedule_appointment",
    "data": {
      "appointmentId": "appt-id",
      "googleCalendarLink": "https://calendar.google.com/...",
      "outlookCalendarLink": "https://outlook.live.com/...",
      "appleCalendarLink": "data:text/calendar;...",
      "icalContent": "BEGIN:VCALENDAR..."
    }
  }
  ```
- `POST /chat/new` - Create a new chat
  ```json
  {
    "title": "New Chat",
    "userId": "optional-user-id"
  }
  ```
- `GET /chat` - List all chats (optionally filtered by userId)
- `GET /chat/:chatId` - Get chat history with all messages

### Utilities
- `GET /geocode?q=address` - Geocode address to coordinates (rate limited: 1 req/sec)
- `POST /nlu/parse` - Parse user message for intent/entities
  ```json
  {
    "message": "I need a cardiologist near downtown tomorrow"
  }
  ```
- `GET /health` - Health check endpoint

## 🤖 MCP Tools

The MCP server exposes the following tools for AI agents:

- `search_doctors` - Find doctors by specialty and location
- `check_availability` - Get available time slots for a doctor
- `book_appointment` - Book an appointment
- `geocode` - Convert address to coordinates
- `parse_message` - Extract intent and entities from user message

## 🎤 Voice Features

### Web (Browser)
- **Speech Recognition**: 
  - **Browser STT Mode**: Uses `window.SpeechRecognition` (Chrome/Edge) - free, browser-native
  - **Live Voice Agent Mode**: WebSocket streaming to voice agent service with local Whisper STT
- **Speech Synthesis**: Uses `speechSynthesis` API (client-side, free)
- Real-time transcription and voice responses
- Toggle between Browser STT and Live Voice Agent modes

### Mobile
- **TTS**: `expo-speech` (cross-platform, free)
- **STT**: 
  - **Browser STT Mode**: `@react-native-voice/voice` (Android supported, iOS placeholder)
  - **Live Voice Agent Mode**: HTTP endpoint to voice agent service
- Toggle between Browser STT and Live Voice Agent modes

### Live Voice MCP Agent (Optional)
- **STT**: Local Whisper model (faster-whisper) - streaming, low-latency
- **LLM**: Local Ollama model (deepseek-r1, llama3.2, etc.) - free, self-hosted
- **MCP Integration**: Connects to existing MCP tools via Express API
- **WebSocket**: Real-time audio streaming for web clients
- **HTTP Fallback**: Text-based chat endpoint for mobile clients
- **100% Free**: No API costs, all processing local

## 🔒 Security

- OAuth tokens stored encrypted in database
- API key authentication for MCP and mobile clients
- CORS configured for allowed origins
- Input validation with Zod schemas
- Rate limiting on geocoding and booking endpoints

## 🧪 Development

### Database Management

```bash
# Create migration
pnpm prisma:migrate

# View database
pnpm prisma:studio

# Reset database (dev only)
pnpm --filter @voice-appointment/api prisma migrate reset
```

### Type Checking

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

## 📝 Workflow

1. **User speaks/types**: "I need a dentist near downtown tomorrow"
2. **NLU parses**: Extracts specialty (dentist), location (downtown), date (tomorrow)
3. **System searches**: Finds nearest dentists using geocoding
4. **Checks availability**: Queries each doctor's calendar for free slots
5. **Shows options**: Displays available time slots
6. **User confirms**: Books appointment with doctor selection
7. **Chat title updates**: Automatically changes to "Appointment with [Doctor Name]"
8. **Calendar links generated**: System creates links for Google Calendar, Outlook, and Apple Calendar
9. **iCal export**: Generates .ics file content for universal calendar compatibility
10. **Confirmation**: User receives confirmation with multiple calendar link options

## ✨ Recent Features

### Calendar Enhancements
- **Multi-platform calendar support**: Direct links for Google Calendar, Outlook, and Apple Calendar
- **iCal export**: Universal .ics file format for any calendar application
- **Enhanced event details**: Calendar events include doctor information, patient details, appointment reason, and symptoms
- **One-click calendar addition**: Users can add appointments to their preferred calendar with a single click

### Chat Management
- **Smart chat titles**: Chat titles automatically update to "Appointment with [Doctor Name]" when a doctor is selected
- **Chat persistence**: All conversations are saved and can be accessed later
- **Auto-refresh**: Chat list automatically updates when titles change
- **Multi-chat support**: Users can have multiple concurrent chat sessions

## 🚧 Future Enhancements

- Doctor working hours configuration
- Email/SMS reminders
- Appointment cancellation/rescheduling
- Interactive map for doctor selection
- Multi-language support
- Calendar event reminders and notifications
- Recurring appointment support

## 📄 License

MIT

## 🤝 Contributing

This is a demo project. Contributions welcome!

## 📞 Support

For issues or questions, please open an issue in the repository.