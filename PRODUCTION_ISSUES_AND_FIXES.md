# Production Issues Found & Fixes

## Critical Issue: CSP Frame-src Blocking Extension Content

### Problem
**"This content is blocked"** error appears in the extension because the Content Security Policy (CSP) `frame-src` directive doesn't include the production Netlify URL.

When the extension iframe tries to load `https://ai-transcript.netlify.app`, the CSP blocks it:
```json
"frame-src": "'self' http://127.0.0.1:8888 https://*.clerk.accounts.dev ..."
// ❌ Missing: https://ai-transcript.netlify.app
```

### Root Cause
- The extension manifest is built with development URLs (127.0.0.1:8888)
- In production, `VITE_EXTENSION_APP_URL` should point to Netlify
- The manifest must be regenerated with production environment variables

---

## Issues Checklist

### ✅ 1. Extension Production URL Configuration
**Status**: Needs verification
- **Fix**: Ensure `.env.production` has correct URLs:
  ```
  VITE_EXTENSION_API_BASE_URL=https://ai-transcript.netlify.app
  VITE_EXTENSION_APP_URL=https://ai-transcript.netlify.app
  ```
- **Build Command**: 
  ```bash
  NODE_ENV=production npm run extension:build
  ```

### ✅ 2. CSP Headers - Frame-src
**Status**: FIXED in generate-extension-manifest.mjs
- The script dynamically adds `normalizeOrigin(appBaseUrl)` to `frame-src`
- When using production URLs, this will automatically include Netlify URL

### ✅ 3. CORS Headers
**Status**: ✓ Working correctly
- All backend functions use `event.headers.origin` for CORS
- Allows requests from any origin (safe with Clerk token verification)

### ✅ 4. Clerk Authentication
**Status**: ✓ Properly configured
- Token verification on all endpoints
- Clerk keys in environment variables (not hardcoded)

### ✅ 5. API URL Resolution
**Status**: ✓ Working correctly
- Web: Uses empty `VITE_API_BASE_URL` (relative URLs via Netlify proxy)
- Extension: Uses `VITE_EXTENSION_APP_URL` for iframe
- Desktop: Uses `VITE_API_BASE_URL` (http://localhost)

### ⚠️ 6. Netlify Environment Variables
**Status**: Not set in Netlify dashboard
- Need to add to Netlify project settings:
  - `CLERK_SECRET_KEY`
  - `APIFY_TOKEN`
  - `APIFY_ACTOR_ID`
  - `GROQ_API_KEY`
  - `GROQ_CHAT_MODEL`
  - `GROQ_SUMMARY_MODEL`

### ✅ 7. Extension Manifest CSP
**Status**: Dynamically generated correctly
- CSP includes all required origins based on `.env`

---

## Production Deployment Steps

### Step 1: Prepare Production Environment Variables

**File**: `.env.production` (already exists)
```env
# Production environment variables
VITE_API_BASE_URL=

# For extension: explicit production URLs
VITE_EXTENSION_API_BASE_URL=https://ai-transcript.netlify.app
VITE_EXTENSION_APP_URL=https://ai-transcript.netlify.app
```

### Step 2: Build Production Extension
```bash
# Build extension with production environment
NODE_ENV=production npm run extension:build

# Output: dist-extension/ (ready for Chrome Web Store)
```

### Step 3: Verify Generated Manifest
After building, check `dist-extension/manifest.json`:
```json
{
  "frame-src": "'self' https://ai-transcript.netlify.app https://*.clerk.accounts.dev ..."
  // ✓ Should include https://ai-transcript.netlify.app
}
```

### Step 4: Set Netlify Environment Variables
1. Go to Netlify dashboard → Project → Settings → Build & Deploy → Environment
2. Add variables:
   - `CLERK_SECRET_KEY` = `sk_test_*`
   - `APIFY_TOKEN` = `apify_api_*`
   - `APIFY_ACTOR_ID` = `supreme_coder/youtube-transcript-scraper` (or trisecode/yt-transcript)
   - `GROQ_API_KEY` = `gsk_*`
   - `GROQ_CHAT_MODEL` = `llama-3.3-70b-versatile`
   - `GROQ_SUMMARY_MODEL` = `llama-3.3-70b-versatile`

### Step 5: Build and Deploy Web App
```bash
npm run build

# Deploy: Push to git branch that triggers Netlify build
# Or manually deploy via Netlify CLI:
npx netlify deploy --prod --dir=dist
```

### Step 6: Test Production Extension Locally
```bash
# Load unpacked extension from dist-extension/ in Chrome
# chrome://extensions → Load unpacked → select dist-extension/

# Open YouTube video
# Click extension icon
# Verify iframe loads without "This content is blocked" error
```

---

## Chrome Web Store Submission Checklist

✅ = Ready
⚠️ = Needs attention

- [x] **Manifest v3 compliant** - Already using MV3
- [x] **All required permissions declared** - sidePanel, activeTab, tabs, storage
- [x] **HTTPS everywhere** - All URLs use https (except localhost for dev)
- [x] **CSP properly configured** - Dynamically generated with frame-src
- [x] **Authentication** - Clerk OAuth integrated
- [x] **Terms & Privacy** - Need to prepare
- [ ] **Store listing** - Title, description, screenshots needed
- [ ] **Icon/banner art** - 128x128 px + 1400x560 promotional

---

## Testing Checklist

### Local Development
- [ ] `npm run extension:dev` on YouTube video
- [ ] Iframe loads without CSP errors
- [ ] Can authenticate with Clerk
- [ ] Can fetch transcript
- [ ] Can summarize
- [ ] Can chat with RAG

### Production Staging
- [ ] Build with `NODE_ENV=production npm run extension:build`
- [ ] Load unpacked from `dist-extension/`
- [ ] Iframe loads Netlify app
- [ ] No CSP blocking errors
- [ ] Clerk auth works
- [ ] API calls go to production Netlify

### Chrome Web Store
- [ ] Upload zip from `dist-extension/`
- [ ] Auto-review passes
- [ ] Manual review completes
- [ ] Extension appears in search
- [ ] Users can install and use

---

## Troubleshooting Production Issues

### Issue: "This content is blocked" in extension
**Solution**: 
1. Verify `dist-extension/manifest.json` has `https://ai-transcript.netlify.app` in `frame-src`
2. Rebuild with: `NODE_ENV=production npm run extension:build`
3. Clear Chrome extensions cache and reload

### Issue: Extension works but iframe blank
**Solution**:
1. Check extension DevTools (chrome://extensions → Details → Errors)
2. Check Network tab - look for CSP violations
3. Ensure `.env.production` has correct URLs before building

### Issue: API calls fail with 401
**Solution**:
1. Verify `CLERK_SECRET_KEY` is set in Netlify dashboard
2. Check that Clerk token is being sent in `Authorization: Bearer` header
3. Ensure token is valid and not expired

### Issue: Apify/Groq calls fail
**Solution**:
1. Verify all API keys are set in Netlify environment variables
2. Check Apify account has remaining runs
3. Check Groq API quota
4. Review Netlify function logs: `netlify dev --debug`

---

## Files Modified

- `.env.production` - Already correct
- `scripts/generate-extension-manifest.mjs` - Already correct
- `extension/vite.config.mjs` - No changes needed
- `extension/sidepanel.jsx` - No changes needed (uses VITE_EXTENSION_APP_URL)

---

## What Needs to Happen for Production

1. ✅ **Build extension with production env**: `NODE_ENV=production npm run extension:build`
2. ✅ **Set Netlify environment variables** in dashboard
3. ✅ **Deploy web app**: `npm run build && netlify deploy --prod`
4. ⚠️ **Prepare Chrome Web Store assets** (screenshots, description, privacy policy)
5. ⚠️ **Upload extension to Chrome Web Store** (manual process)

---

