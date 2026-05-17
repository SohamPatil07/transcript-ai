# Chrome Web Store Upload & Deployment Guide

## 📋 Pre-Submission Checklist

### 1. Prepare Production Extension Build
```bash
# Build for production
NODE_ENV=production npm run extension:build

# Verify output in dist-extension/
# Should contain: manifest.json, sidepanel.html, background.js, etc.
```

### 2. Test Extension Locally
```bash
# Open Chrome and navigate to: chrome://extensions/
# Enable "Developer mode" (toggle in top right)
# Click "Load unpacked"
# Select the dist-extension/ folder
# Open YouTube video
# Click extension icon → verify app loads without CSP errors
```

### 3. Create Chrome Developer Account
1. Go to [Google Play Console](https://play.google.com/console) or [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with Google account
3. Accept developer agreement
4. Pay $5 registration fee

---

## 📦 Package Extension for Upload

### Step 1: Create Distribution Package
```bash
# Create a zip file of the dist-extension folder
cd dist-extension
zip -r ../transcript-ai-extension.zip .

# Or use 7-Zip on Windows:
# Right-click dist-extension → 7-Zip → Add to archive → transcript-ai-extension.zip
```

### Step 2: Verify Package Contents
The zip should contain:
```
transcript-ai-extension.zip
├── manifest.json ✓ (with production CSP)
├── sidepanel.html ✓
├── sidepanel-*.js ✓ (bundled)
├── sidepanel-*.css ✓ (bundled)
├── background.js ✓
├── rules.json ✓
└── assets/ ✓
    ├── *-*.js
    └── *-*.css
```

**Check manifest.json CSP before uploading:**
```bash
grep -A1 "frame-src" dist-extension/manifest.json
# Should include: https://ai-transcript.netlify.app
```

---

## 🚀 Upload to Chrome Web Store

### Step 1: Access Developer Dashboard
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/register)
2. Click "Create new item"
3. Select "Publish for organizations" or "Private" (for testing)

### Step 2: Upload Extension Package
1. Click "Upload" or "Browse" → select `transcript-ai-extension.zip`
2. Wait for validation (usually 1-2 minutes)
3. Fix any manifest errors if they appear

### Step 3: Complete Store Listing

#### Basic Info
- **Name**: Transcript AI
- **Summary** (45 chars max):  
  "Extract and analyze YouTube transcripts with AI"

#### Description (3000 chars max):
```
Transcript AI is a Chrome extension that helps you analyze YouTube videos directly 
from your browser. Extract transcripts, get instant AI-powered summaries, and ask 
questions about the content using our RAG (Retrieval-Augmented Generation) chatbot.

Features:
• One-click transcript extraction from any YouTube video
• AI-powered summaries of video content
• Interactive chat with your transcripts (ask questions)
• Automatic history and offline access
• Free tier available
• No ads or tracking

How it works:
1. Open any YouTube video
2. Click the Transcript AI icon in your browser
3. Extract the transcript with one click
4. Get a summary or ask the AI about the content

Privacy:
• Your transcripts are stored locally in your browser
• We use Clerk for secure authentication
• API calls are encrypted and logged securely
• Read our full privacy policy: [your-domain]/privacy

Requirements:
• Google account (for Clerk sign-in)
• Active internet connection
```

#### Screenshots (Required)
Create 4-5 screenshots (1280x800 px):

**Screenshot 1**: Extension on YouTube video
- Show: YouTube video visible, extension panel open, "YouTube video detected" message

**Screenshot 2**: Extracted Transcript
- Show: Full transcript text visible in side panel

**Screenshot 3**: AI Summary
- Show: Summary section with generated summary

**Screenshot 4**: Chat Feature
- Show: Chat interface with Q&A

**Screenshot 5**: History
- Show: Transcript history with multiple items

**Tips**:
- Use Chrome DevTools to capture side-panel (F12 → 3 dots → More tools → Rendering → Emulate... → any size)
- Annotate with arrows/text (use Figma or Canva)
- Show actual content, not blank screens

#### Promotional Image (1400x560 px)
- Large, clear title: "Transcript AI"
- Tagline: "Extract & Analyze YouTube Videos"
- Visual: YouTube video icon + AI icon + speech bubble
- Background: gradient or solid color

#### Icon Assets
- **128x128 px**: Your app icon (required)
- **48x48 px**: Chrome Web Store small icon
- **16x16 px**: Favicon

#### Permissions Justification
The extension requests these permissions:

| Permission | Justification |
|-----------|--------------|
| `activeTab` | To detect YouTube videos on current tab |
| `tabs` | To identify video URLs and open new tabs |
| `sidePanel` | To show the Transcript AI interface |
| `storage` | To save your transcript history locally |
| `declarativeNetRequest` | (Currently unused, can remove if not needed) |

**Permissions Explanation Text:**
```
Transcript AI only accesses:
• The YouTube URL of the video you're watching (never content of other sites)
• Your browser storage for transcript history
• YouTube and our API servers for transcript extraction

We never collect, sell, or share your personal data.
```

#### Categories
- Select: **Productivity** or **Education**

#### Language & Locale
- Primary: English

#### Content Rating
- Select: **Everyone** (G rating - no violence, adult content, etc.)

---

## 🔐 Privacy & Legal Documents

### Create Privacy Policy
**Host on your domain** (e.g., `yourdomain.com/privacy`)

**Example structure:**
```markdown
# Privacy Policy for Transcript AI

Last Updated: [Date]

## Information We Collect
- YouTube URLs you process
- Transcript text (stored locally in your browser)
- User profile info from Clerk (name, email)

## How We Use Information
- To provide transcript extraction and AI analysis
- To improve our service
- To comply with legal obligations

## Data Storage
- Transcripts: Local browser storage (your device)
- User account: Clerk (secure authentication provider)
- API logs: Encrypted in our servers

## Third-Party Services
- Clerk: Authentication (https://clerk.com/privacy)
- Apify: YouTube transcript extraction (https://apify.com/privacy)
- Groq: LLM API (https://groq.com/privacy)

## Your Rights
- Delete your data: Contact us or sign out
- Access your data: Through your Clerk profile
- Opt-out: Uninstall the extension

## Contact
Email: contact@yourdomain.com

---
```

### Create Terms of Service
**Host on your domain** (e.g., `yourdomain.com/terms`)

**Key sections:**
- Acceptable use (no illegal content, respect copyright)
- Limitation of liability
- Warranty disclaimer
- Term and termination
- Changes to service

---

## ✅ Submission Process

### Step 1: Complete All Fields
- [ ] Extension package uploaded & validated
- [ ] Store listing complete (name, description, category)
- [ ] Screenshots added (4-5 images, 1280x800)
- [ ] Promotional image added (1400x560)
- [ ] Icon/logo added (128x128)
- [ ] Privacy policy URL provided
- [ ] Permissions justified
- [ ] Content rating set to "Everyone"

### Step 2: Review & Publish
1. Click "Submit for review"
2. Accept Google's policies:
   - [ ] Manifest V3 compliant
   - [ ] No malware or harmful code
   - [ ] Respects user privacy
   - [ ] Follows Chrome Web Store policies
3. Submit for automated review

### Step 3: Wait for Review
- **Automated review**: 1-2 hours (check for malware, manifest issues)
- **Manual review**: 24-72 hours (humans review functionality)
- **Email notifications** when review completes

### Step 4: Publish
Once approved:
1. Dashboard shows "Published"
2. Extension appears in Chrome Web Store search in ~1 hour
3. Share the store link with users

---

## 📊 Post-Launch Monitoring

### Setup Analytics
1. Dashboard → Analytics section
2. Monitor:
   - Daily installs/uninstalls
   - User retention
   - Crash reports
   - Error messages

### Handle Reviews
1. Check "Reviews" tab regularly
2. Respond professionally to feedback
3. Fix bugs reported by users
4. Release updates as needed

### Update Process
```bash
# Make code changes
# Rebuild extension
NODE_ENV=production npm run extension:build

# Create new zip
cd dist-extension && zip -r ../transcript-ai-extension-v0.2.0.zip .

# Upload to dashboard
# Dashboard → Items → Your extension → Upload new package
# Increment version in package.json + manifest.json
# Submit for review (usually faster for updates)
```

---

## 🆘 Troubleshooting Chrome Web Store

### Issue: "Invalid manifest" error
**Solution:**
- Verify `manifest.json` is valid JSON (use jsonlint.com)
- Check all required fields present
- Ensure no syntax errors in CSP

### Issue: "Permissions not justified"
**Solution:**
- Remove unused permissions
- Add clear permission explanations
- Remove `declarativeNetRequest` if unused

### Issue: "Screenshots too large" or wrong format
**Solution:**
- Screenshots: 1280x800 px, JPG or PNG
- Promotional: 1400x560 px
- Use GIMP, Canva, or Figma to create

### Issue: "Privacy policy URL not accessible"
**Solution:**
- Ensure URL is public (not behind login)
- Use HTTPS only
- Test URL in incognito mode
- Add to your website root

### Issue: Rejected for "harmful code"
**Solutions:**
- Malware scan: https://www.virustotal.com/
- Check for eval() or dangerously injected code
- Ensure no data collection without consent
- No cryptocurrency mining
- No ads without disclosure

### Issue: Waiting too long for review
**Solutions:**
- Check dashboard → "In review" status
- Some extensions take 5-7 days
- If stuck > 1 week, contact Chrome Web Store support
- Re-submit if auto-review fails

---

## 📝 Markdown Checklists for Each Stage

### Before Build
- [ ] Tested locally on YouTube
- [ ] No CSP errors in DevTools
- [ ] Clerk auth working
- [ ] API calls working
- [ ] Summary generation working
- [ ] RAG chat working

### Before Upload
- [ ] `NODE_ENV=production npm run extension:build` complete
- [ ] Manifest includes production URLs in CSP
- [ ] Zip created from `dist-extension/`
- [ ] Zip contents verified
- [ ] Screenshots prepared (4-5)
- [ ] Promotional image ready
- [ ] Icon ready (128x128)
- [ ] Privacy policy written
- [ ] Terms of service written

### Before Submission
- [ ] All store listing fields complete
- [ ] Description is professional & accurate
- [ ] Category selected (Productivity)
- [ ] Content rating set (Everyone)
- [ ] Permissions explained
- [ ] Legal documents linked

### After Publication
- [ ] Shared with beta testers
- [ ] Monitored first week analytics
- [ ] Responded to initial reviews
- [ ] Prepared for bug fixes

---

