# KripTik AI Mobile Companion App

A React Native mobile app built with Expo SDK 52 for the KripTik AI platform.

## Features

- **Home Dashboard**: Overview of projects, active builds, and quick actions
- **Build Management**: Monitor and manage builds with real-time progress
- **Feature Agents**: Deploy and monitor autonomous coding agents
- **AI Lab**: Training jobs and model management
- **Push Notifications**: Real-time updates for build status, agent completion
- **QR Pairing**: Seamlessly pair with the web app
- **Deep Linking**: Navigate directly to specific builds, projects, or agents

## Prerequisites

1. Node.js 18+
2. Expo CLI: `npm install -g eas-cli`
3. Expo account: https://expo.dev

## Font Setup

Download and place the following fonts in `assets/fonts/`:

- Cal Sans: https://github.com/calcom/font (CalSans-SemiBold.otf)
- Outfit: https://fonts.google.com/specimen/Outfit (Outfit-SemiBold.ttf)
- DM Sans: https://fonts.google.com/specimen/DM+Sans (DMSans-Regular.ttf, DMSans-Medium.ttf, DMSans-SemiBold.ttf)
- JetBrains Mono: https://fonts.google.com/specimen/JetBrains+Mono (JetBrainsMono-Regular.ttf)

## Setup

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

## EAS Build

```bash
# Login to Expo
eas login

# Build for iOS (development)
eas build --platform ios --profile development

# Build for Android (development)
eas build --platform android --profile development

# Build for production
eas build --platform all --profile production
```

## Configuration

Update the following before production:

1. `app.json`:
   - Set `extra.eas.projectId` to your EAS project ID

2. `eas.json`:
   - Set Apple Developer credentials for iOS submission
   - Set Google Play credentials for Android submission

## Project Structure

```
kriptik-mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── build/[id].tsx     # Build detail screen
│   ├── project/[id].tsx   # Project detail screen
│   └── feature-agent/[id].tsx
├── components/
│   ├── icons/             # Custom SVG icons
│   └── ui/                # Reusable UI components
├── lib/
│   ├── api.ts             # API client
│   ├── deep-linking.ts    # Deep link handling
│   ├── design-system.ts   # Design tokens
│   └── notifications.ts   # Push notifications
├── store/                  # Zustand stores
└── assets/                 # Fonts, images, icons
```

## Design System

The app uses a "Liquid Glass 3D" aesthetic matching the KripTik web app:

- **Colors**: Stone backgrounds with amber/gold accents
- **Typography**: Cal Sans (display), Outfit (headings), DM Sans (body), JetBrains Mono (code)
- **Animations**: React Native Reanimated 3 with spring physics
- **Haptics**: Expo Haptics for tactile feedback

## API Integration

The app connects to the KripTik backend API for:
- Authentication (Better Auth)
- Project management
- Build orchestration
- Feature agent control
- AI Lab training
- Push notifications

## Deep Links

The app supports the following deep link patterns:

- `kriptik://project/{id}` - Open project
- `kriptik://build/{id}` - Open build
- `kriptik://agent/{id}` - Open feature agent
- `kriptik://training/{id}` - Open training job
- `kriptik://pair?code={code}` - Device pairing

## License

Proprietary - KripTik AI
