## ROLE
You are a senior full-stack React developer. Build a complete, production-ready frontend for an Audio Sentiment Analysis SaaS Platform. Every file must be fully functional — no placeholder TODOs, no incomplete logic, no skeleton code.

## TECH STACK (strict — no substitutions)
Framework     : React 18 + Vite (JavaScript only, no TypeScript)
Routing       : React Router DOM v6
Auth          : Firebase Authentication (email/password only)
HTTP          : Axios (centralized service file)
Icons         : Lucide React (no other icon lib)
Styling       : Plain CSS files (no Tailwind, no CSS-in-JS, no styled-components)
Recording     : Browser MediaRecorder API (no external library)
State         : React Context API (no Redux, no Zustand)

## PROJECT STRUCTURE (create every file exactly as listed)
src/
├── api/
│   └── api.js
├── components/
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   ├── StatCard.jsx
│   ├── AudioUploader.jsx
│   ├── AudioRecorder.jsx
│   ├── ResultCard.jsx
│   ├── Loader.jsx
│   └── EmptyState.jsx
├── context/
│   └── AuthContext.jsx
├── firebase/
│   └── firebase.js
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ForgotPassword.jsx
│   ├── Dashboard.jsx
│   ├── UploadAudio.jsx
│   ├── RecordAudio.jsx
│   ├── Result.jsx
│   ├── History.jsx
│   ├── Profile.jsx
│   ├── Settings.jsx
│   └── NotFound.jsx
├── routes/
│   └── ProtectedRoute.jsx
├── styles/
│   └── global.css
├── App.jsx
└── main.jsx
Root files: package.json, .env.example, vite.config.js, index.html

## ENVIRONMENT VARIABLES
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
# Python ML Backend
VITE_API_BASE_URL=http://localhost:5000/api

## FIREBASE RULES
- Initialize Firebase in src/firebase/firebase.js using env vars
- Export: app, auth
- Use onAuthStateChanged in AuthContext for real-time session sync
- Firebase UID must be attached to every API request (header or body)
- Firebase handles auth only — backend never receives passwords
- Protect all dashboard routes via ProtectedRoute component

## API SERVICE (src/api/api.js)
Create one Axios instance with baseURL = VITE_API_BASE_URL.
Export these named functions:

uploadAudio(file, firebaseUid)        → POST /analyze/upload   [FormData]
submitRecordedAudio(blob, firebaseUid) → POST /analyze/record   [FormData]
getSentimentResult(id, firebaseUid)    → GET  /result/:id
getAnalysisHistory(firebaseUid)        → GET  /history/:firebaseUid
deleteAnalysis(id, firebaseUid)        → DELETE /history/:id
getUserStats(firebaseUid)             → GET  /stats/:firebaseUid

Until backend is live, each function must return realistic mock data
so the UI is fully testable without a running server.

## PAGES — DETAILED REQUIREMENTS

Login / Register / ForgotPassword
- Full-page centered layout, brand logo/name top, premium card design
- Real Firebase auth calls with try/catch
- Inline form validation (empty fields, email format, min 6 char password)
- Error messages displayed in styled alert boxes (not console.log)
- Success state on forgot password (email sent message)
- Links between all three auth pages

Dashboard
- Sidebar + top Navbar layout (collapsible on mobile)
- Welcome card: "Good morning/afternoon, [displayName or email]"
- 4 stat cards: Total Analyses, Positive, Negative, Neutral (with icons)
- Recent analyses list (last 5 items with sentiment badge + timestamp)
- 2 quick-action cards: Upload Audio, Record Audio (clickable → navigate)
- Insight tip card at bottom
- All data fetched via getUserStats + getAnalysisHistory

UploadAudio
- Drag-and-drop zone (ondragover, ondrop events) + click to browse
- Accept: audio/mpeg, audio/wav, audio/x-m4a (.mp3 .wav .m4a)
- Show: filename, file size (formatted: KB/MB), HTML5 audio preview player
- Validate: file type whitelist, max 50MB size
- Upload via FormData using uploadAudio() with Firebase UID
- Animated progress/loading state during API call
- On success → navigate to /result/:id

RecordAudio
- Request microphone via navigator.mediaDevices.getUserMedia
- Display permission error gracefully if denied
- Start / Stop recording buttons with visual state change
- Live recording timer (MM:SS format, updates every second)
- Animated pulsing mic icon while recording
- Playback preview after stop (audio element with recorded blob URL)
- Submit via submitRecordedAudio() with Firebase UID
- Loading state during API call → navigate to /result/:id on success

Result
- Receive result ID from navigation state OR from URL param
- Fetch full result via getSentimentResult()
- Large sentiment badge: POSITIVE (green) / NEGATIVE (red) / NEUTRAL (gray)
- Confidence score shown as animated CSS progress bar + percentage text
- Emotion breakdown: grid of emotion cards (joy, anger, sadness, fear, etc.)
  each with icon + label + percentage bar
- Transcript placeholder section (shows "Transcript not available" if empty)
- AI Insight box: contextual message based on sentiment
- Audio metadata: filename, duration, file size, analyzed date/time
- Two CTA buttons: "Analyze Another" (→ /upload) + "View History" (→ /history)

History
- Fetch all analyses via getAnalysisHistory(uid)
- Table/card list: filename, sentiment badge, confidence %, date
- Search bar: filter by filename (client-side, instant)
- Filter dropdown: All / Positive / Negative / Neutral
- Delete button per row (calls deleteAnalysis, updates list optimistically)
- Clicking a row → navigate to /result/:id
- Beautiful EmptyState component when list is empty

Profile
- Avatar circle with initials derived from email
- Display: email, Firebase UID, account created date (Firebase metadata)
- Read-only styled fields (not editable inputs)
- Logout button → Firebase signOut → redirect to /login

Settings
- API Base URL display (from env var, not editable)
- Notification toggle UI (visual only, no backend)
- Theme section: shows "Light mode only" lock
- Danger zone: Logout button
- All sections in clean card containers

NotFound (404)
- Centered layout, large 404 number, friendly message
- "Go to Dashboard" button

## UI DESIGN SYSTEM
Theme        : Light only (no dark mode toggle)
Background   : #FFFFFF body, #F8F9FB page bg, #F1F3F7 section bg
Accent       : #6366F1 (indigo-500) primary, #4F46E5 hover
Success      : #10B981  Danger: #EF4444  Warning: #F59E0B
Text         : #111827 primary, #6B7280 secondary, #9CA3AF muted
Border       : #E5E7EB default, #D1D5DB hover
Font         : Inter (load from Google Fonts in index.html)
Cards        : white bg, border-radius 12px, box-shadow 0 1px 3px rgba(0,0,0,0.08)
Buttons      : border-radius 8px, font-weight 500, transition all 0.2s ease
Inputs       : border-radius 8px, border 1.5px solid #E5E7EB, focus border #6366F1
Sidebar      : 240px wide, white, right border, nav items with hover + active states
Navbar       : top bar, white bg, shadow, user avatar right side

Every interactive element must have hover, focus, active, and disabled states in CSS.
Smooth transitions on all state changes (0.2s ease).
Loading spinners must be CSS-only (no GIF, no library).

## MOCK DATA SPEC (return from api.js until backend is live)
uploadAudio mock response:
{ id: "mock-001", status: "success", message: "Analysis complete" }

getSentimentResult mock response:
{ id: "mock-001", sentiment: "POSITIVE", confidence: 87.4,
  emotions: { joy: 72, trust: 58, anticipation: 44, sadness: 12, anger: 5 },
  transcript: "", audioFile: "sample.mp3", duration: "0:32",
  fileSize: "512 KB", analyzedAt: "2024-01-15T10:30:00Z" }

getAnalysisHistory mock response: array of 5 varied result objects

getUserStats mock response:
{ total: 12, positive: 7, negative: 3, neutral: 2 }

## CODE QUALITY REQUIREMENTS
- Every component uses proper React hooks (useState, useEffect, useRef, useCallback)
- No inline styles — all styling via CSS class names defined in global.css
- No console.log in production code (use proper error state variables)
- All async operations wrapped in try/catch/finally
- Loading state set to true before API call, false in finally block
- Error state cleared before each new API call
- All forms prevent default submission
- File: each page has its own clearly named CSS section in global.css
- Clean, readable variable names; no abbreviations except standard ones (uid, btn)
- All Lucide icons imported individually (tree-shakeable)

## DELIVERABLE FORMAT
Output every file in order, each preceded by its relative path as a comment:
// === src/firebase/firebase.js ===
[full file content]
// === src/context/AuthContext.jsx ===
[full file content]
... and so on for ALL files listed in the project structure.

End with a SETUP.md section containing:
1. npm install command with all package names
2. .env setup instructions
3. Firebase console setup steps
4. npm run dev to start
5. How to swap mock data for real backend

## HARD CONSTRAINTS
✗ No TypeScript  ✗ No Tailwind  ✗ No dark mode  ✗ No Redux
✗ No incomplete files  ✗ No placeholder comments saying "add logic here"
✗ No external UI libraries (MUI, Ant, Chakra, etc.)
✓ Every file must be 100% complete and immediately runnable
✓ App must work end-to-end with mock data before backend exists