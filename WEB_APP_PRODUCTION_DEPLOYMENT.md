# Web App Production Deployment Guide

## Netlify Deployment

### Step 1: Verify Environment Variables in Netlify Dashboard

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your "Transcript AI" project
3. Go to: **Site settings** → **Build & deploy** → **Environment**
4. Add these environment variables:

```env
# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key_here

# API Keys
APIFY_TOKEN=your_apify_token_here
APIFY_ACTOR_ID=supreme_coder/youtube-transcript-scraper

# Groq LLM
GROQ_API_KEY=your_groq_api_key_here
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_SUMMARY_MODEL=llama-3.3-70b-versatile
```

⚠️ **IMPORTANT**: Never commit these to git. Use Netlify dashboard only.

### Step 2: Verify Build Configuration

In Netlify dashboard, check:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18 or higher

Expected in `netlify.toml`:
```toml
[build]
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev:vite"
  targetPort = 5173
  port = 8888
```

### Step 3: Deploy Web App

#### Option A: Automatic via Git
```bash
# Push code to GitHub/GitLab connected to Netlify
git add .
git commit -m "Production ready"
git push origin main

# Netlify automatically:
# 1. Builds with npm run build
# 2. Deploys to https://ai-transcript.netlify.app
# 3. Runs functions from netlify/functions/
```

#### Option B: Manual via Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist

# Redeploy functions if changed
netlify deploy --prod
```

### Step 4: Verify Production Deployment

```bash
# Test web app
curl -I https://ai-transcript.netlify.app
# Should return 200

# Test API endpoints
curl -X OPTIONS https://ai-transcript.netlify.app/.netlify/functions/transcribe
# Should return CORS headers

# Test with token
TOKEN="your-clerk-token"
curl -X POST https://ai-transcript.netlify.app/.netlify/functions/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Step 5: Monitor Production

1. **Netlify Dashboard** → Analytics
   - Check builds complete successfully
   - Monitor function execution time

2. **Function Logs**:
   ```bash
   netlify dev --debug
   # Look for errors in transcribe/summarize/chat functions
   ```

3. **Frontend Errors**:
   - Set up error tracking (Sentry, LogRocket, etc.)
   - Or check browser console on production

---

## Web App Features Verification

### ✅ Authentication
```javascript
// Test in browser console (on https://ai-transcript.netlify.app)
// After signing in:
console.log(window.location.href)
// Should show no auth errors
```

### ✅ Transcript Extraction
1. Sign in with Clerk
2. Paste YouTube URL: `https://youtube.com/watch?v=dQw4w9WgXcQ`
3. Click "Fetch Transcript"
4. Should show: "Fetching transcript... ✓"

### ✅ AI Summary
1. After transcript loads
2. Click "Summarize"
3. Wait 10-30 seconds for Groq API
4. Should show multi-paragraph summary

### ✅ RAG Chat
1. After transcript loads
2. Type question: "What is the main topic?"
3. Should get answer with source chunks

### ✅ History Persistence
1. Fetch a transcript
2. Refresh page (F5)
3. Transcript should still be in history (localStorage)

### ✅ Download Transcript
1. Click transcript in history
2. Click "Download" icon
3. Should download `.txt` file with transcript

---

## Web App Architecture Verification

### Request Flow (Production)
```
Browser (https://ai-transcript.netlify.app)
  ↓
Clerk Auth Provider
  ↓
React App (main.jsx)
  ↓
API call to /.netlify/functions/transcribe
  ↓
Netlify Function (runs Node.js)
  ↓
Token verification (Clerk SDK)
  ↓
Apify API (YouTube transcript extraction)
  ↓
Response with transcript JSON
  ↓
React component updates (displays transcript)
  ↓
localStorage (saves history)
```

### CORS Flow (Extension)
```
Chrome Extension (chrome-extension://...)
  ↓
fetch() to https://ai-transcript.netlify.app
  ↓
Netlify Function receives request
  ↓
createCorsHeaders() uses request.headers.origin
  ↓
Response includes "Access-Control-Allow-Origin: chrome-extension://..."
  ↓
Browser allows response (CORS passed)
  ↓
Extension receives data
```

---

## Performance Optimization

### Frontend Bundle Size
```bash
# Check bundle size
npm run build

# Output should show something like:
# ✓ 423 modules transformed.
# dist/index.html                     0.46 kB
# dist/assets/main-a1b2c3d4.js        180 kB (gzip: 58 kB)
# dist/assets/main-a1b2c3d4.css       12 kB (gzip: 3 kB)
```

**Optimization tips:**
- Lucide icons: Imported selectively (not bundled)
- React: Minified in production build
- CSS: Minified and optimized
- Assets: Hashed for cache busting

### Function Performance
```bash
# Check function execution times in Netlify dashboard
# Typical times:
# - transcribe: 5-15 seconds (depends on Apify)
# - summarize: 15-30 seconds (depends on Groq)
# - chat: 3-8 seconds (depends on Groq)
```

---

## Troubleshooting Production

### Issue: "This content is blocked" in extension
**Solution**: 
- Rebuild extension: `NODE_ENV=production npm run extension:build`
- Verify CSP in manifest has Netlify URL
- Reinstall extension in Chrome

### Issue: API calls failing with CORS error
**Solution**:
- Check browser console for exact error
- Verify `createCorsHeaders()` in _rag.js
- Check environment variables in Netlify dashboard

### Issue: Clerk authentication not working
**Solutions**:
1. Verify VITE_CLERK_PUBLISHABLE_KEY is set correctly
2. Check Clerk dashboard for app configuration
3. Ensure redirect URI includes: `https://ai-transcript.netlify.app`
4. Clear browser cookies and try again

### Issue: Apify API returning errors
**Solutions**:
1. Check APIFY_TOKEN in Netlify env variables
2. Verify actor ID: `supreme_coder/youtube-transcript-scraper`
3. Check Apify account has remaining runs (free: 5/month)
4. Try different YouTube video (some have captions disabled)

### Issue: Groq API slow or timing out
**Solutions**:
1. Check GROQ_API_KEY valid in Netlify
2. Check Groq API quota (free: ~10k requests/month)
3. Verify model name: `llama-3.3-70b-versatile`
4. Check Netlify function timeout settings (default 26s, max 120s)

### Issue: High memory usage in functions
**Solution**:
- Current implementation doesn't cache transcripts server-side (by design)
- Each request processes fresh data
- Monitor Netlify dashboard for spikes

---

## Security Checklist

- [x] HTTPS only (Netlify provides free SSL)
- [x] Environment variables not in git (using Netlify dashboard)
- [x] Clerk token verification on all endpoints
- [x] CORS headers properly configured
- [x] No hardcoded secrets in code
- [x] CSP headers configured
- [x] Manifest V3 compliant (extension)
- [ ] Rate limiting (not implemented - consider for future)
- [ ] Request validation (basic - could be stricter)

---

## Monitoring & Alerts

### Setup Email Alerts in Netlify
1. Netlify Dashboard → Site settings → Notifications
2. Add notification for:
   - Build failures
   - Function errors
   - Deploy completions

### Recommended Monitoring Tools
- **Error Tracking**: Sentry, LogRocket
- **Uptime Monitoring**: UptimeRobot
- **Analytics**: Google Analytics, Plausible
- **Logs**: Netlify Dashboard (built-in)

---

## Rollback Procedure

If something breaks in production:

### Quick Rollback via Netlify
1. Go to Netlify Dashboard → Deploys
2. Find last known-good deploy
3. Click → Publish deploy
4. Site reverts immediately

### Manual Rollback
```bash
# If using git
git revert HEAD
git push origin main
# Netlify auto-deploys previous version
```

---

## Updates & Maintenance

### Regular Maintenance Schedule

**Weekly**:
- Check Netlify build logs for warnings
- Monitor analytics for errors

**Monthly**:
- Update npm dependencies: `npm update`
- Check Apify/Groq API quotas
- Review error tracking dashboard

**Quarterly**:
- Update major dependencies: `npm upgrade`
- Test all features end-to-end
- Backup configuration

### Version Updates
```bash
# Bump version
npm version patch  # 0.1.0 → 0.1.1 (bug fixes)
npm version minor  # 0.1.0 → 0.2.0 (features)
npm version major  # 0.1.0 → 1.0.0 (breaking changes)

# Commit and tag
git push origin main --tags

# Netlify automatically deploys
```

---

