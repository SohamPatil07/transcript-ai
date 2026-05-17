# Clerk OAuth Extension CSP Fix

## Issue: "content-midge-73.accounts.dev refused to connect"

This error occurs when the extension's Content Security Policy (CSP) blocks Clerk's dynamic authentication domains.

---

## Solution: Updated CSP with Complete Clerk Domain Support

### Step 1: Update the Manifest Generator

✅ **Already done** - The script `scripts/generate-extension-manifest.mjs` has been updated to include:

```javascript
connectSrc = [
  "'self'",
  "https://api.clerk.com",
  "https://clerk.com",
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "https://accounts.dev",           // ← New
  "https://*.accounts.dev",
  "https://*.clerk.dev",
  "https://accounts.google.com",
  "https://*.clerkauth.com",         // ← New
];
```

### Step 2: Rebuild Extension

**Windows:**
```bash
cd c:\Users\Admin\Desktop\transcript-ai
set NODE_ENV=production
npm run extension:build
```

**Or use the script:**
```bash
scripts\production-build.bat
```

**Mac/Linux:**
```bash
NODE_ENV=production npm run extension:build
```

### Step 3: Verify Updated CSP

After rebuilding, check the generated manifest:

```bash
# Windows PowerShell
Select-String -Path dist-extension\manifest.json -Pattern "accounts.dev" -Context 0,2

# Or open the file:
cat dist-extension/manifest.json | grep -A5 "connect-src"
```

**Should show:**
```json
"connect-src 'self' https://ai-transcript.netlify.app https://api.clerk.com https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://accounts.dev https://*.accounts.dev https://*.clerk.dev https://accounts.google.com https://*.clerkauth.com"
```

### Step 4: Clear Extension and Reload

1. Open `chrome://extensions/`
2. Find "Transcript AI"
3. Click "Remove"
4. Click "Load unpacked"
5. Select `dist-extension/` folder
6. Open YouTube video
7. Click extension icon
8. Try logging in

---

## If Issue Persists: Debugging Steps

### Debug Step 1: Check Browser Console

1. Open YouTube
2. Click extension icon
3. Right-click in the side panel → **Inspect**
4. Go to **Console** tab
5. Look for error messages

**Common errors:**
- `CSP violation: connect-src` → Domain not in CSP
- `CSP violation: frame-src` → Iframe URL not in CSP
- `Failed to load script from...` → Script loading blocked

### Debug Step 2: Check Network Tab

In the Inspector:
1. Click **Network** tab
2. Try to login
3. Look for failed requests (red X)
4. Failed domains are likely missing from CSP

### Debug Step 3: Check Extension Service Worker

1. `chrome://extensions/`
2. Find "Transcript AI" → Click "Details"
3. Scroll down to "Inspect views"
4. Click "service worker" link
5. Check **Console** for errors

### Debug Step 4: Verify Environment

```bash
# Check .env files have correct Clerk key
type .env | findstr CLERK

# Should show:
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# For production, also check:
type .env.production | findstr CLERK
```

---

## Alternative Solution: Use "Open" Button

If Clerk auth still doesn't work in the side panel, use the **"Open" button** in the extension:

1. Click extension icon
2. Click **"Open"** button (external link icon)
3. Opens web app in new tab
4. Sign in via Clerk in the new tab
5. Go back to extension - it will detect the session
6. Can now use extension features

This bypasses the iframe CSP issue entirely because the web app (not iframe) handles auth.

---

## Advanced Fix: Allow OAuth in Popup Window

If you want OAuth to work within the side panel, here's an alternative approach:

### Modify sidepanel.jsx to Handle Clerk Differently

```javascript
// In extension/sidepanel.jsx, add this code to detect extension context

useEffect(() => {
  // When in extension iframe, ensure Clerk can communicate
  if (window.location !== window.parent.location) {
    // We're in an iframe
    // Clerk needs cross-origin messaging to work
    
    // Add meta tag for Clerk
    const clerkMeta = document.createElement('meta');
    clerkMeta.name = 'clerk-handle-redirect';
    clerkMeta.content = 'true';
    document.head.appendChild(clerkMeta);
  }
}, []);
```

But this is unnecessary if you use the "Open" button approach above.

---

## Permanent Solution: Whitelisting Complete Clerk Domain Set

The updated CSP now includes all Clerk domains:

```
API:
  - https://api.clerk.com

Auth domains:
  - https://clerk.com
  - https://*.clerk.com
  - https://*.clerk.accounts.dev
  - https://accounts.dev
  - https://*.accounts.dev
  - https://*.clerk.dev

Google OAuth:
  - https://accounts.google.com

Additional:
  - https://*.clerkauth.com
```

This covers:
- ✅ Clerk API calls
- ✅ Clerk OAuth pages
- ✅ Dynamic tenant domains (like `content-midge-73.accounts.dev`)
- ✅ Google OAuth
- ✅ Clerk authentication services

---

## Testing Checklist

After rebuild:

- [ ] Extension loads without errors
- [ ] Opens on YouTube without CSP errors
- [ ] Sign up button visible
- [ ] Click sign up → doesn't show "refused to connect"
- [ ] Can enter email and password
- [ ] Can click Google OAuth button
- [ ] OAuth flow completes
- [ ] Redirects back to extension
- [ ] Shows "Signed in" state
- [ ] Can fetch transcript

---

## If Still Not Working: Fallback Steps

### Option A: Use "Open" Button (Fastest Fix)
```
1. Click extension
2. Click "Open" button
3. Sign in on the web page
4. Return to extension (it auto-detects session)
5. Use extension features
```

This works because auth happens in the web app (not iframe), avoiding CSP issues.

### Option B: Check Clerk Configuration

Go to [Clerk Dashboard](https://dashboard.clerk.com):
1. Select your app
2. Go to Settings → Domain
3. Verify "Allowed Origins" includes your extension domain
4. Note the exact domain name (e.g., `pk_test_...`)

### Option C: Check Network Connectivity

```bash
# Verify Clerk API is reachable
curl -I https://api.clerk.com

# Verify Clerk tenant domain is reachable
curl -I https://clerk.com
```

Both should return 200/3xx status.

### Option D: Check Browser Extensions

Disable other extensions that might interfere:
1. `chrome://extensions/`
2. Disable all except "Transcript AI"
3. Try logging in again

Some extensions add their own CSP headers that might conflict.

---

## Understanding CSP Errors

### Example: `connect-src` violation
```
Refused to connect to 'content-midge-73.accounts.dev' because it violates the Content Security Policy directive...
```

**Solution**: Add domain to `connect-src` in CSP

### Example: `frame-src` violation
```
Refused to frame 'https://content-midge-73.accounts.dev' because it violates the Content Security Policy directive...
```

**Solution**: Add domain to `frame-src` in CSP

### Example: `script-src` violation
```
Refused to load script 'https://cdn.clerk.com/...' because it violates the Content Security Policy directive...
```

**Solution**: For Manifest V3 extensions, scripts must be from `'self'`. Inline scripts are blocked. This is why we can't embed Clerk directly in some cases.

---

## Updated manifest.json (Production)

After rebuild, your `dist-extension/manifest.json` should have:

```json
{
  "manifest_version": 3,
  "name": "Transcript AI",
  "version": "0.1.0",
  "permissions": ["sidePanel", "activeTab", "tabs", "storage", "declarativeNetRequest"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://youtube.com/*",
    "https://m.youtube.com/*",
    "https://youtu.be/*",
    "https://ai-transcript.netlify.app/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://ai-transcript.netlify.app https://api.clerk.com https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://accounts.dev https://*.accounts.dev https://*.clerk.dev https://accounts.google.com https://*.clerkauth.com; frame-src 'self' https://ai-transcript.netlify.app https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://accounts.dev https://*.accounts.dev https://*.clerk.dev https://accounts.google.com https://*.clerkauth.com;"
  }
}
```

---

## Summary

| Fix | Ease | Reliability |
|-----|------|-------------|
| **Rebuild with updated CSP** | ⭐⭐ | ⭐⭐⭐ (recommended) |
| **Use "Open" button** | ⭐ | ⭐⭐⭐ (fallback) |
| **Clerk popup handling** | ⭐⭐⭐ | ⭐ (complex) |

**Recommendation**: Try the rebuild first. If auth still doesn't work, use the "Open" button method as a user-friendly fallback.

---

