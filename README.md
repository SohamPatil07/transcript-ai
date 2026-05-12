# Transcript AI

A React + Clerk + Netlify app for turning YouTube links into transcripts.

## Stack

- React with Vite for the frontend
- Clerk for authentication and profile management
- Netlify Functions for server-only Apify calls
- Apify actor default: `trisecode/yt-transcript`

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Fill `.env`:

   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y29udGVudC1taWRnZS03My5jbGVyay5hY2NvdW50cy5kZXYk
   CLERK_SECRET_KEY=your-clerk-secret-key
   APIFY_TOKEN=your-apify-token
   APIFY_ACTOR_ID=trisecode/yt-transcript
   ```

3. Run the app locally:

   ```bash
   npm run dev
   ```

## Deployment

Set these environment variables in your deployment provider:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `APIFY_TOKEN`
- `APIFY_ACTOR_ID`

For now, the priority is frontend auth. The app runs with `npm run dev`. The transcription API will need a server deployment target before production.

## Notes

History is currently saved locally in the browser per Clerk user. For cross-device history, add a database later and store rows using the Clerk `userId`.
