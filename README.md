# Voice Appointment Booking System

A full-stack appointment booking application with voice and text interfaces, powered by Next.js, Express.js, and Model Context Protocol (MCP). Users can book appointments with doctors by speaking or typing their requirements, and the system automatically checks Google Calendar availability and schedules appointments.

## 🏗️ Architecture

This is a monorepo containing:
- **Web Frontend** (`apps/web`): Next.js 14 with Tailwind CSS and Web Speech API
- **Backend API** (`apps/api`): Express.js with TypeScript, Prisma, and Google Calendar integration
- **MCP Server** (`apps/mcp`): Model Context Protocol server exposing booking tools
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
- **Google Calendar API** (OAuth per doctor)
- **chrono-node** for date parsing
- **geolib** for distance calculations
- **Nominatim** (OpenStreetMap) for geocoding

### MCP
- **@modelcontextprotocol/sdk** for MCP server implementation

### Mobile (Future)
- **Expo** + **React Native**
- **expo-speech** for TTS
- **react-native-voice** for STT

## 📋 Prerequisites

- **Node.js 20+**
- **pnpm 9+** (package manager)
- **Google Cloud Console** account (for OAuth credentials)
- **Optional**: Ollama (for local LLM enhancement)

## 🛠️ Setup

### 1. Clone and Install

```bash
# Install dependencies for all workspaces
pnpm install
```

### 2. Google OAuth Setup

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

# Optional: Local LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

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

# Optional: Seed sample doctors
pnpm prisma:seed
```

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
- `GET /appointments/:id` - Get appointment details
- `DELETE /appointments/:id` - Cancel appointment

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
- **Speech Recognition**: Uses `window.SpeechRecognition` (Chrome/Edge)
- **Speech Synthesis**: Uses `speechSynthesis` API
- Real-time transcription and voice responses

### Mobile
- **TTS**: `expo-speech` (cross-platform)
- **STT**: `@react-native-voice/voice` (Android supported, iOS placeholder)

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
4. **Checks availability**: Queries each doctor's Google Calendar for free slots
5. **Shows options**: Displays available time slots
6. **User confirms**: Books appointment and creates Google Calendar event
7. **Confirmation**: User receives confirmation with calendar link

## 🚧 Future Enhancements

- Doctor working hours configuration
- Email/SMS reminders
- Appointment cancellation/rescheduling
- Interactive map for doctor selection
- Multi-language support
- Integration with more calendar providers

## 📄 License

MIT

## 🤝 Contributing

This is a demo project. Contributions welcome!

## 📞 Support

For issues or questions, please open an issue in the repository.

