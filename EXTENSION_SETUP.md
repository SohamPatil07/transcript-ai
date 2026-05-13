# Chrome Extension Setup

This repo now includes a Chrome side panel extension that loads the real Transcript AI web app inside the side panel, while also detecting the current YouTube tab and passing that URL into the app.

## What it does now

- opens from the Chrome toolbar
- uses a side panel UI
- reads the current YouTube tab
- loads your actual web app inside the side panel
- pre-fills the current YouTube URL into the app
- keeps the same sign-in, transcript flow, and UI as the website

## Why this changed

The earlier extension-only UI diverged from the web app and did not behave consistently enough.

The current approach is simpler and more reliable:

- the extension is now a wrapper around the existing app
- the extension still adds side-panel behavior and YouTube-tab detection
- sign-in, transcript fetching, history, and UI all come from the main app itself

## Files involved

- `extension/sidepanel.html`
- `extension/sidepanel.jsx`
- `extension/sidepanel.css`
- `extension/public/background.js`
- `extension/vite.config.mjs`
- `scripts/generate-extension-manifest.mjs`

## Required env values

Use these public values in your root `.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_EXTENSION_API_BASE_URL=http://127.0.0.1:8888
VITE_EXTENSION_APP_URL=http://127.0.0.1:8888
```

Recommended local setup:

- `VITE_EXTENSION_APP_URL`
  - the URL the side panel should load as the real app
- `VITE_EXTENSION_API_BASE_URL`
  - kept for alignment with the project config, though the embedded app itself uses the existing app/backend behavior

For production, point both to your live site:

```env
VITE_EXTENSION_API_BASE_URL=https://your-live-site.netlify.app
VITE_EXTENSION_APP_URL=https://your-live-site.netlify.app
```

## Backend values still required

Your app backend still needs:

```env
CLERK_SECRET_KEY=...
APIFY_TOKEN=...
APIFY_ACTOR_ID=trisecode/yt-transcript
GROQ_API_KEY=...
```

## Build the extension

Build once:

```bash
npm run extension:build
```

Watch-build during development:

```bash
npm run extension:dev
```

The unpacked extension output is written to:

```txt
dist-extension/
```

## Load the extension into Chrome

1. Make sure the local app/backend is running:

```bash
npm run dev
```

2. Build the extension:

```bash
npm run extension:build
```

3. Open Chrome:

```txt
chrome://extensions
```

4. Turn on `Developer mode`
5. Click `Load unpacked`
6. Select:

```txt
C:\Users\Admin\Desktop\transcript-ai\dist-extension
```

7. Pin the extension if needed
8. Open a YouTube video
9. Click the extension icon to open the side panel

## Test flow

1. Open a supported YouTube video page
2. Open the Transcript AI side panel
3. Confirm the status bar shows that a YouTube video was detected
4. The real app should load inside the panel
5. The URL field in the app should be prefilled from the current tab
6. Sign in normally using the same app sign-in
7. Click the normal transcript button inside the embedded app

## When you change code

1. Rebuild the extension:

```bash
npm run extension:build
```

2. Return to:

```txt
chrome://extensions
```

3. Click `Reload` on the Transcript AI extension
4. Reopen the side panel

## Logo and icon sizes

The side panel now uses:

- `Transcript-AI-Logo.png`

For Chrome toolbar and store icons, still prepare PNG exports at:

- `16x16`
- `32x32`
- `48x48`
- `128x128`

Recommended master source:

- `512x512`

Important note:

- use the symbol/mark only for the tiny extension icons
- do not use the full wordmark for `16x16` and `32x32`
