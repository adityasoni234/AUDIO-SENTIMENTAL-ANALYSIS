# AudioSense — Setup Guide

## 1. Install dependencies
```bash
npm install
```

## 2. Environment setup
Copy `.env.example` to `.env` — your Firebase values are already filled in:
```bash
cp .env.example .env
```
Your `.env` is pre-configured with your project credentials.

## 3. Firebase Console — Required Steps

### Enable Authentication
1. Go to https://console.firebase.google.com → Select your project
2. **Authentication** → Sign-in method → **Email/Password** → Enable → Save

### Enable Firestore
1. **Firestore Database** → Create database
2. Select **Start in test mode** (then apply real rules below)
3. Choose your region → Done

### Apply Security Rules
In Firestore → Rules tab, paste the contents of `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/analyses/{analysisId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 4. Run the app
```bash
npm run dev
```
App runs at: http://localhost:3000

## 5. How the DB works
Every audio upload/recording triggers:
1. Mock ML analysis (or real backend if available)
2. Result saved to Firestore: `users/{uid}/analyses/{auto-id}`
3. History, stats, and result pages all read from Firestore in real-time

## 6. Connect real ML backend
In `src/api/api.js`, the Axios instance points to `VITE_API_BASE_URL`.
Set it in `.env`:
```
VITE_API_BASE_URL=https://your-backend.com/api
```
The `try/catch` in each function will use the real API automatically.
Mock data only triggers when the backend returns an error or is unreachable.

## Project Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account |
| `/forgot-password` | Reset password |
| `/dashboard` | Main dashboard (protected) |
| `/upload` | Upload audio (protected) |
| `/record` | Record audio (protected) |
| `/result/:id` | Analysis result (protected) |
| `/history` | All past analyses (protected) |
| `/profile` | Account info (protected) |
| `/settings` | App settings (protected) |
