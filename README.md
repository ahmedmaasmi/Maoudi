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

## 📖 User Scenarios

### Scenario 1: Voice Booking for Urgent Care

**User**: Sarah, a busy professional, needs to see a dermatologist urgently for a skin rash.

**Interaction Flow**:

1. Sarah opens the web app and clicks "Voice Chat"
2. She speaks: *"I need to see a dermatologist near my office in downtown tomorrow morning"*
3. The system:
   - Parses the request: specialty (dermatology), location (downtown), time (tomorrow morning)
   - Geocodes "downtown" to coordinates
   - Searches for nearby dermatologists within a 10km radius
   - Checks each doctor's Google Calendar for available morning slots
4. System responds: *"I found 3 dermatologists near downtown. Dr. Smith has availability tomorrow at 9:00 AM and 11:00 AM. Would you like to book one of these?"*
5. Sarah: *"Yes, book the 9 AM appointment"*
6. System: *"Please provide your name and email"*
7. Sarah provides her details, and the appointment is booked
8. System confirms: *"Your appointment with Dr. Smith is confirmed for tomorrow at 9:00 AM. 📅 Add to Calendar: • Google Calendar: [link] • Outlook: [link] • Apple Calendar: [link]"*
9. The chat title automatically updates to "Appointment with Dr. Smith"

### Scenario 2: Text-Based Booking for Routine Checkup

**User**: John wants to schedule a routine dental checkup for next week.

**Interaction Flow**:

1. John opens the app and uses the text input option
2. He types: *"I need a dentist appointment next week, preferably in the afternoon"*
3. The system:
   - Extracts: specialty (dentistry), time preference (afternoon), date range (next week)
   - Asks for location: *"Where would you like to find a dentist?"*
4. John: *"Near 123 Main Street"*
5. System geocodes the address and finds nearby dentists
6. System checks availability and shows: *"I found 2 dentists near your location. Dr. Johnson has slots on Tuesday and Thursday afternoons. Which day works for you?"*
7. John selects Tuesday, and the system books the appointment
8. Confirmation with multiple calendar links (Google, Outlook, Apple) is provided
9. Chat title updates to reflect the booked doctor

### Scenario 3: Mobile Voice Booking While Commuting

**User**: Maria is commuting and needs to book a pediatrician appointment for her child.

**Interaction Flow**:

1. Maria opens the mobile app while on the train
2. Uses voice input: *"Book a pediatrician appointment for my daughter next Friday"*
3. System asks for location (uses GPS if permitted)
4. System finds pediatricians and checks availability
5. System: *"I found Dr. Williams available next Friday at 2:00 PM and 4:00 PM"*
6. Maria: *"2 PM works"*
7. System books the appointment and provides calendar links
8. Maria can add the appointment to her preferred calendar (Google, Outlook, or Apple Calendar)
9. Chat title updates to show the booked doctor

### Scenario 4: Complex Multi-Step Booking

**User**: David needs to find a cardiologist for a follow-up appointment with specific requirements.

**Interaction Flow**:

1. David: *"I need to see a cardiologist"*
2. System: *"I can help you find a cardiologist. What location are you looking for?"*
3. David: *"Near the hospital district"*
4. System finds cardiologists and checks availability
5. System: *"I found 2 cardiologists. Dr. Lee has availability this week, and Dr. Chen has slots next week. Which timeframe works for you?"*
6. David: *"This week, but only in the mornings"*
7. System filters and shows: *"Dr. Lee has Tuesday and Wednesday mornings available. Which day?"*
8. David selects Tuesday, provides his information, and the appointment is confirmed
9. System provides calendar links for all major calendar platforms
10. Chat title updates to "Appointment with Dr. Lee"

### Scenario 5: Accessibility-Focused Voice Booking

**User**: Robert has limited mobility and prefers voice interaction.

**Interaction Flow**:

1. Robert uses voice commands exclusively
2. System provides audio feedback for all interactions
3. Robert: *"Find me a general practitioner"*
4. System: *"I found several general practitioners. Would you like me to search by location or show you all available options?"*
5. Robert: *"Show me all options"*
6. System reads out the list of doctors with their availability
7. Robert selects one using voice: *"Book with the first doctor for the earliest available time"*
8. System confirms the booking with audio confirmation

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

