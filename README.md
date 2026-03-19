## Maplist Pro

Maplist Pro is a React + Vite applet that lets you save, organize, and explore Google Maps locations in collections, backed by Firebase and enhanced with Gemini-based categorization.

### Tech stack

- **Frontend**: React 19, Vite, Tailwind (via `@tailwindcss/vite`), `@vis.gl/react-google-maps`
- **Backend/server entry**: `server.ts` (Express + Vite dev server)
- **Data**: Firebase Auth + Firestore
- **AI**: Gemini via `@google/genai`

### Getting started

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment variables**

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

Then fill in the values:

- **Core**
  - `GEMINI_API_KEY` – Gemini API key.
  - `APP_URL` – Public URL where this app is hosted (used for callbacks/links).

- **Firebase**
  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`
  - `FIREBASE_FIRESTORE_DATABASE_ID`

- **Google Maps**
  - `GOOGLE_MAPS_PLATFORM_KEY` – used by `@vis.gl/react-google-maps` (configured in `vite.config.ts` and consumed in `App.tsx`).

> Note: `firebase-applet-config.json` is intentionally **not** used for secrets and is ignored by git. All runtime-sensitive values should come from env vars instead.

3. **Run in development**

```bash
npm run dev
```

This starts the `server.ts` entry which wires up Vite and Express. Open the printed URL in your browser.

4. **Build for production**

```bash
npm run build
```

Optionally preview the production build locally:

```bash
npm run preview
```

### Firebase & security

- Firestore rules live in `firestore.rules`; they enforce per-user access and an admin path.
- Schema definitions for entities and collections are described in `firebase-blueprint.json`.
- Make sure you deploy updated rules when you change the data model or access patterns.

### Scripts (from `package.json`)

- `npm run dev` – start the app (server + Vite).
- `npm run build` – create a production build.
- `npm run preview` – preview the built app.
- `npm run lint` – type-check with TypeScript.

