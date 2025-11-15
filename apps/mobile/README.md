# Voice Appointment Mobile App

Expo React Native app for voice appointment booking.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm start
```

## Features

- Voice input using `@react-native-voice/voice` (Android)
- Text-to-speech using `expo-speech`
- Location services for finding nearby doctors
- Integration with the shared API

## Permissions

The app requires:
- Microphone permission (for voice input)
- Location permission (for finding nearby doctors)

These are configured in `app.json`.

## Note

This is a placeholder MVP implementation. Full voice support on iOS requires additional native module configuration.

