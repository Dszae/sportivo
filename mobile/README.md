# Sportivo Native Mobile App (Android & iOS)

A 100% native market-standard mobile application built with **React Native**, **Expo**, **Expo AV (ExoPlayer)**, and **Native Notifications**.

---

## Features
- **Native Android ExoPlayer:** Hardware-accelerated HLS (.m3u8) video streaming with multi-server CDN switching.
- **Nepal Premier League (NPL 2026):** Full 32-match schedule, ball-by-ball updates, and team colors for all 8 franchises.
- **Football & Cricket Desks:** Live match tickers, league filters (Premier League, La Liga, Champions League), and countdowns in Nepal Standard Time (NST).
- **Personal Watchlist:** Follow any team or star any match for automatic 5-minute kickoff alerts.
- **Native Push & Haptics:** Physical vibration feedback on goals/wickets via `expo-haptics`.
- **Offline First:** Automatic local caching with `@react-native-async-storage/async-storage`.

---

## How to Run on Your Mobile Phone (Instant Preview)

1. Open your terminal in the `mobile` directory:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
2. Install **Expo Go** from Google Play Store on your Android phone (or App Store on iPhone).
3. Scan the QR code shown in your terminal.
4. The native app will instantly launch on your physical device!

---

## How to Build the Standalone `.apk` File

### Method A: Automated GitHub Actions (No local Android SDK needed)
1. Go to your GitHub repository: `https://github.com/Dszae/sportivo/actions`
2. Select **"Build Real Native Android APK (React Native)"**.
3. Click **"Run workflow"**.
4. Once completed, download the generated **`Sportivo-Native-Android-APK`** directly!

### Method B: 1-Command Cloud Build via EAS
```bash
cd mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
EAS will output a direct download link for the signed `.apk` file that installs on any Android phone.
