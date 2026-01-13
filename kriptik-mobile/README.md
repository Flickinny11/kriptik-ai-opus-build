# KripTik Mobile

Mobile companion app for KripTik AI, built with React Native and Expo.

## Features

- Check on running builds from anywhere
- Receive push notifications for build status updates
- Start new builds directly from mobile
- View project history and build results
- Secure authentication with OAuth support

## Development Setup

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- iOS: Xcode (for iOS Simulator)
- Android: Android Studio (for Android Emulator)

### Installation

```bash
cd kriptik-mobile
npm install
```

### Running Locally

```bash
# Start the dev server
npx expo start

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android
```

### Environment Variables

Create a `.env` file:

```env
EXPO_PUBLIC_API_URL=https://api.kriptik.ai
EXPO_PUBLIC_EAS_PROJECT_ID=your-project-id
```

## Building for Production

### EAS Build Setup

1. Login to EAS:
   ```bash
   eas login
   ```

2. Configure project:
   ```bash
   eas build:configure
   ```

3. Update `eas.json` with your credentials

### Building

```bash
# Development build (for testing)
eas build --profile development

# Preview build (internal distribution)
eas build --profile preview

# Production build
eas build --profile production
```

## App Store Submission

### iOS

1. Set up Apple Developer account credentials in `eas.json`
2. Run: `eas submit -p ios`

### Android

1. Add Google Play service account key
2. Run: `eas submit -p android`

## Project Structure

```
kriptik-mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Auth flow
│   ├── (tabs)/             # Main tab navigation
│   ├── project/[id].tsx    # Project detail
│   └── build/[id].tsx      # Build detail
├── components/             # Reusable components
├── lib/                    # Utilities
│   ├── api.ts              # API client
│   ├── auth.ts             # Auth utilities
│   └── notifications.ts    # Push notifications
├── store/                  # Zustand stores
├── assets/                 # Static assets
└── app.json                # Expo config
```

## Design System

The app follows the KripTik design system:

- **Colors**: Stone backgrounds with amber/gold accents
- **Typography**: Outfit (display), DM Sans (body), JetBrains Mono (code)
- **Components**: Consistent with web app styling

## Push Notifications

The app uses Expo Push Notifications for real-time build updates:

- Build started
- Build progress milestones
- Build complete/failed
- Feature agent completion (for ghost mode)

## Authentication

Supports multiple auth methods:

- Email/password
- GitHub OAuth
- Google OAuth

Auth tokens are securely stored using Expo SecureStore.
