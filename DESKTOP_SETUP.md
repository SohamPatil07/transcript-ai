# Desktop App Setup

This project now includes a Windows-first Electron wrapper around the existing React/Vite app.

## What stays the same

- React UI stays in `src/`
- Clerk auth stays in the frontend
- Netlify functions stay the backend
- Apify and Groq stay server-side

## New scripts

- `npm run desktop:dev`
  - Starts Vite and launches Electron against the Vite renderer
- `npm run desktop:build`
  - Builds the web app for desktop packaging
- `npm run desktop:dist`
  - Builds the web app and creates a Windows installer in `release/`

## Backend URL setup

The desktop app cannot use browser-relative URLs like `/.netlify/functions/...` unless the app is loaded from the same server.

So the renderer now supports a base URL:

```env
VITE_API_BASE_URL=http://127.0.0.1:8888
```

Recommended values:

- local Netlify dev: `http://127.0.0.1:8888`
- deployed backend: your deployed site origin, for example `https://your-site.netlify.app`

For packaged desktop builds, you can also set:

```env
DESKTOP_API_BASE_URL=https://your-site.netlify.app
```

If `DESKTOP_API_BASE_URL` is present, Electron exposes it to the renderer and it takes precedence over `VITE_API_BASE_URL`.

## Local development workflow

### Option 1: local backend + local desktop app

Run Netlify backend in one terminal:

```bash
npm run dev
```

Run Electron app in another terminal:

```bash
npm run desktop:dev
```

Use:

```env
VITE_API_BASE_URL=http://127.0.0.1:8888
```

### Option 2: desktop app against deployed backend

Set:

```env
VITE_API_BASE_URL=https://your-site.netlify.app
```

Then run:

```bash
npm run desktop:dev
```

## Packaging Windows installer

Run:

```bash
npm install
npm run desktop:dist
```

Installer output will be generated in:

```txt
release/
```

## Notes

- v1 is Windows-first
- updates are manual
- auth, transcript generation, summary, and chat still require internet access
- macOS can be added later without restructuring the current Electron layout
