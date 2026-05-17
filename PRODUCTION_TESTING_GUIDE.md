# Complete Production Testing Guide

## Pre-Launch Testing Checklist

### Part 1: Web App Testing (https://ai-transcript.netlify.app)

#### 1.1 Authentication
- [ ] **Clerk OAuth works**
  - [ ] Sign up with Google account
  - [ ] Check profile page loads
  - [ ] Sign out and back in
  - [ ] Check profile picture updates

- [ ] **Session persistence**
  - [ ] Sign in
  - [ ] Refresh page (F5)
  - [ ] Still logged in? ✓
  - [ ] Close browser tab
  - [ ] Open app again in new tab
  - [ ] Still logged in? ✓

#### 1.2 Transcript Extraction
- [ ] **Valid YouTube URLs work**
  - [ ] `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  - [ ] `https://youtu.be/dQw4w9WgXcQ`
  - [ ] `https://youtube.com/shorts/XYZ123`
  - [ ] `https://m.youtube.com/watch?v=XYZ`

- [ ] **Invalid URLs are rejected**
  - [ ] Random text: "hello world"
  - [ ] Wrong domain: "https://vimeo.com/..."
  - [ ] Malformed URL: "youtube.com/wat?"
  - [ ] Shows error: "Paste a valid YouTube link"

- [ ] **Transcript loads correctly**
  - [ ] Fetching shows spinner
  - [ ] Completes in < 20 seconds
  - [ ] Shows: title, video ID, transcript text
  - [ ] Can see full transcript text
  - [ ] Copy to clipboard works

- [ ] **Error handling**
  - [ ] Video without captions: Shows "No transcript available"
  - [ ] Private video: Shows error
  - [ ] Network error: Shows "Try again" button

#### 1.3 AI Summarization
- [ ] **Summary generation works**
  - [ ] Loads transcript first
  - [ ] Click "Summarize"
  - [ ] Shows "Generating summary..." spinner
  - [ ] Completes in 20-40 seconds
  - [ ] Shows multi-paragraph summary
  - [ ] Summary is relevant to transcript

- [ ] **Summary caching**
  - [ ] Generate summary (takes time)
  - [ ] Refresh page
  - [ ] Summary appears instantly (cached)

- [ ] **Long transcripts handled**
  - [ ] Try video with >10,000 word transcript
  - [ ] Should summarize chunks, then combine
  - [ ] Final summary is concise

#### 1.4 RAG Chat
- [ ] **Chat interface works**
  - [ ] Can type question
  - [ ] Send button works
  - [ ] Question appears in chat
  - [ ] Loading spinner shows
  - [ ] Answer appears in 5-10 seconds

- [ ] **RAG accuracy**
  - [ ] Ask: "What is the main topic?"
  - [ ] Answer references transcript
  - [ ] Ask: "What timestamp?" (shouldn't be in transcript)
  - [ ] Answer says: "Not in transcript"

- [ ] **Chat history**
  - [ ] Multiple questions accumulate
  - [ ] Context used in answers
  - [ ] Refresh page
  - [ ] Chat history persists

- [ ] **Source citations**
  - [ ] Each answer shows "Sources:"
  - [ ] Click source expands snippet
  - [ ] Source is relevant to answer

#### 1.5 History Management
- [ ] **History saves**
  - [ ] Fetch 3 transcripts
  - [ ] All appear in sidebar history
  - [ ] Refresh page
  - [ ] All still visible

- [ ] **History search/filter**
  - [ ] Search by title works
  - [ ] Filters results correctly

- [ ] **Delete transcript**
  - [ ] Click trash icon
  - [ ] Removed from history
  - [ ] localStorage updated

#### 1.6 Profile Features
- [ ] **Update profile name**
  - [ ] Edit name field
  - [ ] Save changes
  - [ ] Shows success message
  - [ ] Clerk updates name

- [ ] **Upload profile picture**
  - [ ] Click upload button
  - [ ] Select image
  - [ ] Shows preview
  - [ ] Uploads successfully

#### 1.7 Download Feature
- [ ] **Download transcript as .txt**
  - [ ] Click download icon
  - [ ] File downloads
  - [ ] Contains: title, URL, full transcript
  - [ ] File is readable in text editor

#### 1.8 Performance & Stability
- [ ] **Page load time**
  - [ ] Initial load: < 3 seconds
  - [ ] Network tab shows no 404s

- [ ] **No JavaScript errors**
  - [ ] Open DevTools (F12)
  - [ ] Console tab is clean (no red errors)

- [ ] **Responsive design**
  - [ ] Desktop: 1920x1080 ✓
  - [ ] Tablet: 768x1024 ✓
  - [ ] Mobile: 375x667 ✓

- [ ] **Memory leaks**
  - [ ] Open DevTools → Performance
  - [ ] Record 5 minutes of interaction
  - [ ] Memory usage stable (not climbing)

---

### Part 2: Chrome Extension Testing (on YouTube)

#### 2.1 Extension Installation
- [ ] **Load unpacked extension**
  - [ ] `chrome://extensions/`
  - [ ] Developer mode ON
  - [ ] Load unpacked → `dist-extension/`
  - [ ] Extension appears in list
  - [ ] Shows "Transcript AI" icon

#### 2.2 CSP & Loading
- [ ] **No CSP errors** (main fix!)
  - [ ] Open YouTube video
  - [ ] Click extension icon
  - [ ] Side panel opens
  - [ ] ❌ NO "This content is blocked" error
  - [ ] App frame loads
  - [ ] Can see Transcript AI UI

- [ ] **Extension DevTools clean**
  - [ ] Right-click extension icon → Inspect
  - [ ] Console tab: no red errors
  - [ ] Network tab: no 404s

#### 2.3 Video Detection
- [ ] **YouTube video detected**
  - [ ] On watch page: "YouTube video detected" ✓
  - [ ] On Shorts: "YouTube video detected" ✓
  - [ ] On home page: "No supported video detected" ✓
  - [ ] Shows current video URL

- [ ] **Refresh button**
  - [ ] Click refresh button
  - [ ] Updates to current video
  - [ ] Spinner works

#### 2.4 Authentication in Extension
- [ ] **First time use**
  - [ ] Click "Open" button
  - [ ] Redirects to main app
  - [ ] Shows sign up/sign in
  - [ ] Can sign in with Google

- [ ] **After authentication**
  - [ ] Go back to extension
  - [ ] User is logged in
  - [ ] Can use extension features

#### 2.5 Extension Features
- [ ] **Fetch transcript (same as web app)**
  - [ ] Paste URL
  - [ ] Click fetch
  - [ ] Shows transcript

- [ ] **Summarize (same as web app)**
  - [ ] Click Summarize
  - [ ] Shows summary

- [ ] **Chat (same as web app)**
  - [ ] Ask questions
  - [ ] Get answers

- [ ] **Open in browser button**
  - [ ] Click "Open" button
  - [ ] Opens in new tab
  - [ ] Shows full app at: https://ai-transcript.netlify.app

#### 2.6 Cross-Tab Communication
- [ ] **Extension and web app sync**
  - [ ] Fetch transcript in extension
  - [ ] Open web app in new tab
  - [ ] Transcript appears in history
  - [ ] Can use same transcript

- [ ] **Multiple YouTube tabs**
  - [ ] Open 2 YouTube videos
  - [ ] Switch tabs
  - [ ] Extension shows correct video each time

#### 2.7 Performance & Stability
- [ ] **Frame loads smoothly**
  - [ ] No lagging
  - [ ] Scrolling smooth
  - [ ] Interactions responsive

- [ ] **Memory usage reasonable**
  - [ ] Open extension
  - [ ] Fetch transcript
  - [ ] Close extension
  - [ ] Memory released (no leak)

---

### Part 3: API & Backend Testing

#### 3.1 Clerk Token Verification
- [ ] **Invalid token rejected**
  ```bash
  curl -X POST https://ai-transcript.netlify.app/.netlify/functions/transcribe \
    -H "Authorization: Bearer invalid-token" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://youtube.com/watch?v=XYZ"}'
  
  # Response: 401 Unauthorized
  ```

- [ ] **Expired token rejected**
  - [ ] Sign out from app
  - [ ] Try to fetch transcript
  - [ ] Shows: "Session expired. Please sign in again."

#### 3.2 Apify Integration
- [ ] **YouTube transcript extraction works**
  - [ ] Returns: { title, transcript_text, segments, language }
  - [ ] No "No transcript available" unless video truly has none

- [ ] **Error handling**
  - [ ] Video without captions → clear error message
  - [ ] Network error → retry works
  - [ ] Apify quota exceeded → helpful message

#### 3.3 Groq LLM
- [ ] **Summarization works**
  - [ ] Returns coherent summary
  - [ ] Respects word limits
  - [ ] Captures key points

- [ ] **Chat generation**
  - [ ] Answers questions from transcript
  - [ ] Refuses questions outside scope
  - [ ] Cites sources

#### 3.4 CORS Headers
- [ ] **Requests from extension allowed**
  - [ ] No CORS errors in console
  - [ ] All API calls succeed

- [ ] **Origin header correct**
  - [ ] Extension origin: `chrome-extension://...`
  - [ ] Web app origin: `https://ai-transcript.netlify.app`
  - [ ] CORS responses include correct origin

---

### Part 4: Error Handling Testing

#### 4.1 Network Errors
- [ ] **Offline handling**
  - [ ] Open DevTools → Network tab
  - [ ] Throttle to "Offline"
  - [ ] Try to fetch transcript
  - [ ] Shows: "Network error. Check connection."

- [ ] **API timeout**
  - [ ] Slow network: "Request took too long"
  - [ ] Retry button works

#### 4.2 Quota Exceeded
- [ ] **Apify quota exceeded**
  - [ ] Error: "Monthly quota exceeded. Try tomorrow."
  - [ ] Links to pricing/account

- [ ] **Groq API quota exceeded**
  - [ ] Error: "Service rate limited. Try again soon."

#### 4.3 Invalid Input
- [ ] **Empty URL**
  - [ ] Paste blank
  - [ ] Error: "Paste a valid YouTube link"

- [ ] **Extremely long transcript** (1M+ chars)
  - [ ] Should handle or show: "Transcript too large"

---

### Part 5: Security Testing

#### 5.1 XSS Prevention
- [ ] **Script in transcript doesn't execute**
  - [ ] Find video with `<script>` in captions
  - [ ] Display as text, not executed
  - [ ] Console shows no errors

#### 5.2 Token Security
- [ ] **Token not in localStorage** (except by Clerk)
  - [ ] Open DevTools → Application → LocalStorage
  - [ ] No auth token visible
  - [ ] Only: transcript history, user prefs

#### 5.3 CSRF Protection
- [ ] **Clerk token prevents CSRF**
  - [ ] Extension: has valid Clerk token
  - [ ] Can make requests
  - [ ] No CSRF tokens needed (Clerk handles)

---

### Part 6: Browser Compatibility

Test on:
- [ ] **Chrome 120+**
- [ ] **Chromium-based** (Edge, Brave, Opera)
- [ ] **Mobile Chrome** (Android)

**Not needed** (Manifest V3 Chrome-only):
- ❌ Firefox (uses WebExtensions API)
- ❌ Safari (uses App Extensions)

---

## Test Execution Plan

### Week 1: Functional Testing
1. **Monday**: Web app authentication
2. **Tuesday**: Transcript extraction
3. **Wednesday**: Summarization & chat
4. **Thursday**: Extension features
5. **Friday**: Error handling

### Week 2: Non-Functional Testing
1. **Monday**: Performance & load testing
2. **Tuesday**: Security testing
3. **Wednesday**: Browser compatibility
4. **Thursday**: End-to-end flows
5. **Friday**: Production readiness sign-off

---

## Test Results Template

```markdown
## Test Run: [Date]

### Web App
- Authentication: ✓ PASS / ✗ FAIL
- Transcripts: ✓ PASS / ✗ FAIL
- Summarization: ✓ PASS / ✗ FAIL
- Chat: ✓ PASS / ✗ FAIL
- History: ✓ PASS / ✗ FAIL
- Error Handling: ✓ PASS / ✗ FAIL

### Extension
- Installation: ✓ PASS / ✗ FAIL
- CSP: ✓ PASS (no blocking errors) / ✗ FAIL
- Features: ✓ PASS / ✗ FAIL
- Performance: ✓ PASS / ✗ FAIL

### Backend
- Clerk Auth: ✓ PASS / ✗ FAIL
- APIs: ✓ PASS / ✗ FAIL
- Error Handling: ✓ PASS / ✗ FAIL

### Blockers / Issues
1. [Issue] - [Severity] - [Solution]

### Sign-off
- [ ] Ready for production
- [ ] Ready for Chrome Web Store
- Tested by: [Name]
- Date: [Date]
```

---

## Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Web app load | < 3s | ? |
| Transcript extract | < 20s | ? |
| Summarization | 20-40s | ? |
| Chat response | < 10s | ? |
| Extension panel load | < 2s | ? |
| Memory (extension) | < 50MB | ? |

Run `npm run build && npm run preview` to test locally before production.

---

