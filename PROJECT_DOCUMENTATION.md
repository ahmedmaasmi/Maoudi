# Voice Appointment Booking System - Complete Project Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Structure](#architecture--structure)
3. [Technology Stack](#technology-stack)
4. [Project Structure (Where Everything Is)](#project-structure-where-everything-is)
5. [How the Project Builds](#how-the-project-builds)
6. [How to Run the Project](#how-to-run-the-project)
7. [Data Flow & User Journey](#data-flow--user-journey)
8. [Key Components Explained](#key-components-explained)
9. [Database Schema](#database-schema)
10. [API Endpoints](#api-endpoints)

---

## Project Overview

**Voice Appointment Booking System** is a full-stack healthcare appointment booking application that allows users to book medical appointments using **natural voice commands** or text input. The system intelligently:

- Understands natural language requests (e.g., "I need a dentist near downtown tomorrow")
- Finds nearby doctors based on specialty and location
- Checks real-time availability from calendars
- Books appointments automatically
- Generates calendar links for Google Calendar, Outlook, and Apple Calendar
- Provides voice and text interfaces for accessibility

### Main Features
- 🎤 **Voice-based booking** - Hands-free appointment scheduling
- 📍 **Location-based search** - Find doctors by proximity
- 📅 **Calendar integration** - Real-time availability checking
- 🤖 **AI-powered NLU** - Natural language understanding
- 💬 **Chat interface** - Conversational booking experience
- 📱 **Multi-platform** - Web and mobile support

---

## Architecture & Structure

This is a **monorepo** (single repository containing multiple projects) managed with:
- **pnpm workspaces** - Package management
- **Turbo** - Build system for running tasks in parallel
- **TypeScript** - Type safety across all projects

### High-Level Architecture

```
┌─────────────────┐
│   Web Client    │  (Next.js - Port 3000)
│  (Voice/Text)   │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│   API Server    │  (Express.js - Port 4000)
│  (Backend)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐  ┌──▼──────┐
│ SQLite│  │  MCP    │  (Model Context Protocol - Port 5005)
│ (DB)  │  │ Server  │
└───────┘  └─────────┘
              │
         ┌────▼──────┐
         │ Voice     │  (Python FastAPI - Port 5007)
         │ Agent     │  (Optional - for live voice)
         └───────────┘
```

### Monorepo Structure

The project is organized into **workspaces**:

1. **apps/** - Application code (frontend, backend, services)
2. **packages/** - Shared code (types, schemas)

---

## Technology Stack

### Frontend (Web)
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Web Speech API** - Browser-native voice recognition and synthesis
- **React Hooks** - State management and side effects

### Backend (API)
- **Node.js 20** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Database ORM (Object-Relational Mapping)
- **SQLite** - Lightweight database (file-based)

### Services
- **MCP Server** - Model Context Protocol server exposing booking tools
- **Voice Agent** (Python) - Optional live voice agent using:
  - FastAPI - Python web framework
  - Ollama - Local LLM (free, self-hosted)
  - Whisper - Speech-to-text

### Utilities
- **chrono-node** - Natural language date parsing
- **geolib** - Distance calculations
- **Nominatim** - OpenStreetMap geocoding (free)
- **Google Calendar API** - Optional calendar sync (OAuth)

---

## Project Structure (Where Everything Is)

```
Maoudi/
│
├── apps/                          # All applications
│   │
│   ├── api/                       # Backend API Server
│   │   ├── src/
│   │   │   ├── index.ts          # Main server entry point
│   │   │   ├── routes/           # API endpoints
│   │   │   │   ├── auth.ts       # Google OAuth routes
│   │   │   │   ├── doctors.ts    # Doctor search endpoints
│   │   │   │   ├── appointments.ts # Booking endpoints
│   │   │   │   ├── availability.ts # Calendar availability
│   │   │   │   ├── chat.ts       # AI chat endpoints
│   │   │   │   ├── geocode.ts    # Address → coordinates
│   │   │   │   ├── nlu.ts        # Natural language parsing
│   │   │   │   └── patients.ts   # Patient management
│   │   │   ├── services/         # Business logic
│   │   │   │   ├── aiAgent.ts    # AI chat service
│   │   │   │   ├── calendar.ts   # Google Calendar integration
│   │   │   │   ├── localCalendar.ts # Local calendar service
│   │   │   │   ├── geocode.ts    # Geocoding service
│   │   │   │   └── nlu.ts        # NLU service
│   │   │   ├── middleware/       # Express middleware
│   │   │   │   ├── auth.ts       # API key authentication
│   │   │   │   ├── errorHandler.ts # Error handling
│   │   │   │   └── rateLimit.ts  # Rate limiting
│   │   │   └── utils/            # Helper functions
│   │   │       ├── prisma.ts     # Database client
│   │   │       ├── env.ts        # Environment validation
│   │   │       ├── encryption.ts # Token encryption
│   │   │       └── cache.ts      # Geocoding cache
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema definition
│   │   │   ├── seed.ts           # Database seeding script
│   │   │   └── dev.db            # SQLite database file
│   │   └── package.json          # Dependencies & scripts
│   │
│   ├── web/                       # Next.js Frontend
│   │   ├── app/                   # Next.js App Router
│   │   │   ├── page.tsx          # Main homepage
│   │   │   ├── layout.tsx        # Root layout
│   │   │   └── globals.css       # Global styles
│   │   ├── components/           # React components
│   │   │   ├── VoiceChat.tsx     # Main voice chat interface
│   │   │   ├── BookingFlow.tsx   # Form-based booking
│   │   │   ├── AppointmentsList.tsx # Appointment list
│   │   │   ├── DoctorsList.tsx   # Doctor directory
│   │   │   ├── voice-chat/       # Voice chat sub-components
│   │   │   │   ├── ChatHeader.tsx
│   │   │   │   ├── ChatList.tsx
│   │   │   │   └── VoiceControls.tsx
│   │   │   ├── ai/               # AI conversation components
│   │   │   │   ├── conversation.tsx
│   │   │   │   ├── message.tsx
│   │   │   │   └── response.tsx
│   │   │   └── ui/               # Reusable UI components
│   │   │       ├── button.tsx
│   │   │       ├── input.tsx
│   │   │       └── ...
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useVoiceRecognition.ts # Voice input hook
│   │   │   ├── useVoiceAgent.ts  # Voice agent connection
│   │   │   └── useGeolocation.ts # Location detection
│   │   ├── lib/                  # Utility libraries
│   │   │   ├── api.ts            # API client functions
│   │   │   ├── voiceAgent.ts    # Voice agent logic
│   │   │   ├── speech.ts        # Speech synthesis
│   │   │   ├── constants.ts     # App constants
│   │   │   └── formatters.ts    # Data formatting
│   │   └── package.json
│   │
│   ├── mcp/                       # MCP Server
│   │   ├── src/
│   │   │   ├── index.ts          # MCP server entry point
│   │   │   ├── client.ts         # API client for MCP tools
│   │   │   └── tools/            # MCP tool definitions
│   │   │       ├── searchDoctors.ts
│   │   │       ├── checkAvailability.ts
│   │   │       ├── bookAppointment.ts
│   │   │       ├── scheduleAppointment.ts
│   │   │       ├── geocode.ts
│   │   │       ├── parseMessage.ts
│   │   │       ├── getDoctorSchedule.ts
│   │   │       ├── getAppointmentStats.ts
│   │   │       └── searchPatientsBySymptom.ts
│   │   └── package.json
│   │
│   ├── voice-agent/              # Python Voice Agent (Optional)
│   │   ├── src/
│   │   │   ├── server.py         # FastAPI WebSocket server
│   │   │   ├── agent.py          # Voice agent logic
│   │   │   └── mcp_client.py     # MCP client connection
│   │   ├── requirements.txt      # Python dependencies
│   │   └── venv/                 # Python virtual environment
│   │
│   └── mobile/                    # React Native Mobile App
│       ├── src/
│       │   ├── App.tsx           # Main app component
│       │   └── services/         # API & voice services
│       └── package.json
│
├── packages/                      # Shared packages
│   └── shared/                   # Shared types & schemas
│       ├── src/
│       │   ├── index.ts          # Main exports
│       │   ├── types/            # TypeScript types
│       │   │   ├── doctor.ts
│       │   │   ├── appointment.ts
│       │   │   ├── patient.ts
│       │   │   └── nlu.ts
│       │   └── schemas/          # Zod validation schemas
│       │       ├── doctor.schema.ts
│       │       ├── appointment.schema.ts
│       │       └── nlu.schema.ts
│       └── package.json
│
├── package.json                   # Root package.json (workspace config)
├── pnpm-workspace.yaml           # pnpm workspace configuration
├── turbo.json                    # Turbo build configuration
└── README.md                     # Project README

```

### Key File Locations

| What You're Looking For | Where It Is |
|------------------------|-------------|
| **Backend API server** | `apps/api/src/index.ts` |
| **Database schema** | `apps/api/prisma/schema.prisma` |
| **API routes** | `apps/api/src/routes/` |
| **Frontend homepage** | `apps/web/app/page.tsx` |
| **Voice chat component** | `apps/web/components/VoiceChat.tsx` |
| **MCP tools** | `apps/mcp/src/tools/` |
| **Shared types** | `packages/shared/src/types/` |
| **Build configuration** | `turbo.json` |
| **Workspace config** | `pnpm-workspace.yaml` |

---

## How the Project Builds

### Build System: Turbo

The project uses **Turbo** (by Vercel) to orchestrate builds across the monorepo. Turbo:
- Runs tasks in parallel when possible
- Caches build outputs
- Only rebuilds what changed

### Build Process

1. **Shared Package First** (`packages/shared`)
   - Compiles TypeScript → JavaScript
   - Generates type definitions (`.d.ts` files)
   - Output: `packages/shared/dist/`

2. **API Server** (`apps/api`)
   - Compiles TypeScript → JavaScript
   - Generates Prisma client
   - Output: `apps/api/dist/`

3. **Web Frontend** (`apps/web`)
   - Next.js builds React app
   - Optimizes images, bundles code
   - Output: `apps/web/.next/`

4. **MCP Server** (`apps/mcp`)
   - Compiles TypeScript → JavaScript
   - Output: `apps/mcp/dist/`

### Build Commands

```bash
# Build everything
pnpm build

# Build specific workspace
pnpm --filter @voice-appointment/api build
pnpm --filter @voice-appointment/web build
pnpm --filter @voice-appointment/shared build
```

### Development vs Production

- **Development**: Uses `tsx watch` (TypeScript execution with hot reload)
- **Production**: Uses compiled JavaScript from `dist/` folders

---

## How to Run the Project

### Prerequisites

1. **Node.js 20+** - [Download](https://nodejs.org/)
2. **pnpm 9+** - Install: `npm install -g pnpm`
3. **Python 3.10+** (for voice agent) - [Download](https://www.python.org/)

### Step-by-Step Setup

#### 1. Install Dependencies

```bash
# Install all dependencies for all workspaces
pnpm install
```

This installs dependencies for:
- Root workspace
- All apps (api, web, mcp, mobile)
- All packages (shared)

#### 2. Set Up Environment Variables

Create `.env` files:

**`apps/api/.env`**:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL="file:./prisma/dev.db"
BACKEND_API_KEY=your_secret_api_key_here
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_char_encryption_key_here
ALLOWED_ORIGINS=http://localhost:3000,exp://*,http://localhost:5005
```

**`apps/web/.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ENABLE_VOICE=true
```

**`apps/mcp/.env`**:
```env
API_BASE_URL=http://localhost:4000
API_KEY=your_secret_api_key_here
```

#### 3. Set Up Database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Seed database with sample data
pnpm prisma:seed
```

This creates:
- SQLite database file: `apps/api/prisma/dev.db`
- Sample doctors, patients, appointments

#### 4. Start Development Servers

```bash
# Start all apps in parallel
pnpm dev
```

This starts:
- **API Server**: http://localhost:4000
- **Web Frontend**: http://localhost:3000
- **MCP Server**: Runs on stdio (for AI tools)

Or start individually:
```bash
pnpm --filter @voice-appointment/api dev    # Backend
pnpm --filter @voice-appointment/web dev    # Frontend
pnpm --filter @voice-appointment/mcp dev    # MCP server
```

#### 5. (Optional) Start Voice Agent

```bash
cd apps/voice-agent
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m src.server
```

---

## Data Flow & User Journey

### Example: User Books Appointment via Voice

1. **User speaks**: "I need a dentist near downtown tomorrow at 2pm"

2. **Frontend** (`apps/web/components/VoiceChat.tsx`):
   - Captures audio via Web Speech API
   - Converts speech → text
   - Sends text to API: `POST /chat`

3. **API** (`apps/api/src/routes/chat.ts`):
   - Receives message
   - Calls NLU service to parse intent

4. **NLU Service** (`apps/api/src/services/nlu.ts`):
   - Extracts: specialty="dentist", location="downtown", date="tomorrow", time="2pm"
   - Returns structured data

5. **AI Agent** (`apps/api/src/services/aiAgent.ts`):
   - Uses MCP tools to:
     - `geocode("downtown")` → coordinates
     - `search_doctors(specialty="dentist", lat, lng)` → list of doctors
     - `check_availability(doctorId, date)` → available slots
     - `schedule_appointment(...)` → books appointment

6. **Database** (`apps/api/prisma/dev.db`):
   - Creates `Appointment` record
   - Updates `Chat` with appointment info

7. **Response**:
   - Returns confirmation with calendar links
   - Frontend displays appointment details
   - Chat title updates to "Appointment with Dr. Smith"

### Data Flow Diagram

```
User Voice Input
    ↓
Web Speech API (Browser)
    ↓
POST /chat { message: "..." }
    ↓
NLU Service (Parse message)
    ↓
AI Agent (MCP Tools)
    ├─→ geocode() → Nominatim API
    ├─→ search_doctors() → Database
    ├─→ check_availability() → Calendar Service
    └─→ schedule_appointment() → Database
    ↓
Database (Prisma/SQLite)
    ↓
Response with Calendar Links
    ↓
Frontend (Display confirmation)
```

---

## Key Components Explained

### 1. API Server (`apps/api`)

**Purpose**: Backend REST API that handles all business logic.

**Key Files**:
- `src/index.ts` - Express server setup, middleware, routes
- `src/routes/` - API endpoints (RESTful routes)
- `src/services/` - Business logic (separated from routes)
- `src/middleware/` - Authentication, error handling, rate limiting
- `prisma/schema.prisma` - Database schema definition

**How it works**:
1. Express server listens on port 4000
2. Routes handle HTTP requests
3. Services contain business logic
4. Prisma ORM interacts with SQLite database
5. Middleware handles auth, errors, rate limiting

### 2. Web Frontend (`apps/web`)

**Purpose**: Next.js React application for user interface.

**Key Files**:
- `app/page.tsx` - Main homepage with mode switcher
- `components/VoiceChat.tsx` - Voice chat interface
- `hooks/useVoiceRecognition.ts` - Voice input hook
- `lib/api.ts` - API client functions

**How it works**:
1. Next.js serves React components
2. Web Speech API captures voice input
3. API calls sent to backend
4. Responses displayed in chat interface
5. Calendar links generated for appointments

### 3. MCP Server (`apps/mcp`)

**Purpose**: Model Context Protocol server that exposes booking tools for AI agents.

**Key Files**:
- `src/index.ts` - MCP server setup, tool registration
- `src/tools/` - Individual tool implementations

**How it works**:
1. MCP server runs on stdio (standard input/output)
2. AI agents connect via MCP protocol
3. Tools are called by AI agents
4. Tools make HTTP requests to API server
5. Results returned to AI agent

**Available Tools**:
- `search_doctors` - Find doctors by specialty/location
- `check_availability` - Check calendar availability
- `book_appointment` - Book an appointment
- `schedule_appointment` - Schedule with full details
- `geocode` - Convert address to coordinates
- `parse_message` - Extract intent from text

### 4. Shared Package (`packages/shared`)

**Purpose**: Shared TypeScript types and Zod schemas used across all apps.

**Key Files**:
- `src/types/` - TypeScript type definitions
- `src/schemas/` - Zod validation schemas

**Why it exists**:
- Ensures type safety across frontend/backend
- Single source of truth for data structures
- Prevents type mismatches

### 5. Voice Agent (`apps/voice-agent`)

**Purpose**: Optional Python service for live voice interaction with local LLM.

**Key Files**:
- `src/server.py` - FastAPI WebSocket server
- `src/agent.py` - Voice agent with Ollama integration
- `src/mcp_client.py` - MCP client for tool calls

**How it works**:
1. WebSocket receives audio streams
2. Whisper converts speech → text
3. Ollama (local LLM) processes text
4. MCP client calls tools
5. Response sent back via WebSocket

---

## Database Schema

The database uses **Prisma ORM** with **SQLite**. Schema defined in `apps/api/prisma/schema.prisma`.

### Main Models

1. **Doctor**
   - `id`, `name`, `specialty`, `address`, `latitude`, `longitude`
   - Has many `Appointment`s
   - Has one `CalendarCredential` (for Google Calendar)

2. **Patient**
   - `id`, `name`, `email`, `phone`
   - Has many `Appointment`s
   - Has many `PatientSymptom`s

3. **Appointment**
   - `id`, `doctorId`, `patientId`, `startUtc`, `endUtc`
   - `userName`, `userEmail`, `userPhone`
   - `reason`, `symptoms`, `notes`
   - `status` (confirmed, cancelled, completed)
   - `gcalEventId` (Google Calendar event ID)

4. **Chat**
   - `id`, `title`, `userId`, `metadata`
   - Has many `ChatMessage`s

5. **ChatMessage**
   - `id`, `chatId`, `role` (user/assistant/system), `content`, `metadata`

6. **CalendarCredential**
   - Stores encrypted Google OAuth tokens for doctors

### Relationships

```
Doctor ──< Appointment >── Patient
  │
  └── CalendarCredential

Patient ──< PatientSymptom

Chat ──< ChatMessage
```

---

## API Endpoints

### Public Endpoints (No Auth Required)

- `GET /health` - Health check
- `GET /doctors/search?specialty=&lat=&lng=&radiusKm=10` - Search doctors
- `POST /chat` - Send chat message
- `GET /appointments` - List appointments
- `GET /appointments/:id` - Get appointment details

### Protected Endpoints (API Key Required)

- `POST /availability` - Check availability
- `POST /appointments/book` - Book appointment
- `POST /appointments/schedule` - Schedule with details
- `DELETE /appointments/:id` - Cancel appointment
- `GET /geocode?q=address` - Geocode address
- `POST /nlu/parse` - Parse natural language
- `GET /patients` - List patients
- `POST /patients` - Create patient

### Authentication Endpoints

- `GET /auth/google/initiate?doctorId=...` - Start OAuth flow
- `GET /auth/google/callback?code=...&state=...` - OAuth callback
- `GET /auth/google/refresh?doctorId=...` - Refresh token

---

## Development Workflow

### Making Changes

1. **Edit code** in any workspace
2. **Type checking**: `pnpm type-check`
3. **Linting**: `pnpm lint`
4. **Test**: Run `pnpm dev` and test in browser

### Database Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm prisma:migrate` (creates migration)
3. Run `pnpm prisma:generate` (updates Prisma client)
4. Restart API server

### Adding New Features

1. **API Endpoint**: Add route in `apps/api/src/routes/`
2. **Frontend Component**: Add in `apps/web/components/`
3. **Shared Types**: Add in `packages/shared/src/types/`
4. **MCP Tool**: Add in `apps/mcp/src/tools/`

---

## Summary for Presentation

### What This Project Does
A voice-enabled appointment booking system that lets users book doctor appointments using natural language (voice or text). It finds nearby doctors, checks availability, and books appointments automatically.

### Key Technologies
- **Frontend**: Next.js, React, Web Speech API
- **Backend**: Express.js, TypeScript, Prisma, SQLite
- **AI Integration**: MCP (Model Context Protocol)
- **Voice**: Browser-native speech recognition + optional Python voice agent

### Architecture Highlights
- **Monorepo** structure (all code in one repo)
- **Type-safe** (TypeScript + shared types)
- **Modular** (separate apps for frontend, backend, MCP)
- **Scalable** (can add mobile, more services)

### What Makes It Special
- Voice-first design for accessibility
- Real-time calendar integration
- Natural language understanding
- Multi-platform calendar support (Google, Outlook, Apple)
- Free, self-hosted voice agent option (Ollama + Whisper)

---

## Quick Reference Commands

```bash
# Install dependencies
pnpm install

# Start all apps
pnpm dev

# Build everything
pnpm build

# Database
pnpm prisma:migrate    # Run migrations
pnpm prisma:studio     # Open database GUI
pnpm prisma:seed       # Seed sample data

# Type checking
pnpm type-check

# Linting
pnpm lint
```

---

**Last Updated**: Based on current project state
**Project Location**: `C:\Users\pc\Documents\Visual Studio\Maoudi`

