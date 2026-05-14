# Chrome Extension & Desktop App - User Guide

## Chrome Extension - No Setup Required ✅

### For You (Developer)
The extension is **already built and ready**. No `npm run dev` or any commands needed:

1. **Open Chrome** → Type `chrome://extensions` in address bar
2. **Enable Developer Mode** → Toggle switch in top-right corner
3. **Click "Load unpacked"** button
4. **Navigate to**: `C:\Users\Admin\Desktop\transcript-ai\dist-extension`
5. **Select folder** and click "Select Folder"
6. ✅ **Done!** Extension appears in your extensions list

### Using the Extension
- Go to any YouTube video page
- Click **Transcript AI** extension icon (should be in toolbar)
- Side panel appears → Click video or "Open" button
- Works directly with your production Netlify backend

### Important: NO Dependencies
- ❌ Don't need `npm run dev`
- ❌ Don't need Node.js running
- ❌ Don't need any local server
- ✅ Works completely standalone

---

## Desktop App - For Other Users

### What They Need (Minimum Requirements)
Users only need **ONE thing**:
```
release/win-unpacked/Transcript AI.exe
```

That's it. No npm, no Node.js, no development tools needed.

### How to Distribute Desktop App

**Option 1: Direct Executable (Simplest)**
1. Copy the entire `release/win-unpacked/` folder
2. Share with users or upload to file hosting
3. Users just double-click `Transcript AI.exe` to run
4. No installation needed - portable app

**Files they need from `win-unpacked/`:**
```
release/win-unpacked/
├── Transcript AI.exe        ← Main application
├── ffmpeg.dll              ← Required libraries
├── libEGL.dll
├── libGLESv2.dll
├── chrome_*.pak
├── icudtl.dat
├── resources/
│   ├── app.asar            ← App bundle
│   └── app-update.yml
└── locales/                ← Language files
```

**All these files must be kept together in the same folder.**

### System Requirements for Users
- **Windows 10 or 11** (64-bit)
- **Internet connection** (to connect to Netlify backend)
- **~400MB disk space** (app + dependencies)
- That's all!

### Installation for End Users
**Super simple - 3 steps:**
1. Download the `release/win-unpacked/` folder
2. Double-click `Transcript AI.exe`
3. Done ✅

No installation wizard, no registry changes, completely portable.

---

## Option 2: Create Windows Installer (For Distribution)

If you want a professional installer (`.exe` installer that users run):

### Current Status
The NSIS installer creation failed due to Windows permission issues. To fix:

**Try this:**
```bash
# Open PowerShell as Administrator, then:
NODE_ENV=production npm run desktop:dist
```

If it still fails, use Option 1 (direct executable) - it's simpler anyway.

---

## Folder Structure After Build

```
transcript-ai/
├── dist-extension/              ← Chrome extension (ready to load)
│   ├── manifest.json           ← Has production URLs
│   ├── sidepanel.html
│   ├── background.js
│   └── assets/
│
├── release/win-unpacked/        ← Desktop app (ready to share)
│   ├── Transcript AI.exe        ← Run this
│   ├── resources/
│   │   └── app.asar            ← Contains built web app
│   └── (other dependencies)
│
└── dist/                        ← Web app build (for Netlify)
    ├── index.html
    └── assets/
```

---

## To Share With Others

### Chrome Extension
1. Go to [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole)
2. Create new app, upload `dist-extension/` as zip
3. Users install from Chrome Web Store directly

### Desktop App

**Easy way (for small team/testing):**
```
Zip entire folder: release/win-unpacked/
Share the zip file with users
Users unzip and run Transcript AI.exe
```

**Professional way (coming soon):**
```
Create NSIS installer (.exe setup file)
Users run installer once
Uninstall via Control Panel like normal apps
```

---

## What Happens When App Runs?

### Desktop App
1. Loads `resources/app.asar` (contains React web app)
2. Reads environment - knows it's Electron app
3. Connects to `https://ai-transcript.netlify.app` for API calls
4. Uses Clerk for authentication
5. Works exactly like web app but in a window

### Chrome Extension
1. Detects if YouTube page is open
2. Shows side panel with your Transcript AI app
3. Connects to same `https://ai-transcript.netlify.app` backend
4. All API calls go through Chrome's extension API with proper permissions

---

## Troubleshooting for End Users

**"App won't start"**
→ Make sure all files from `win-unpacked/` folder are together
→ Don't move files individually

**"Can't connect to Transcript AI"**
→ Check internet connection
→ Check if `https://ai-transcript.netlify.app` is accessible
→ Look for error messages in browser console (Menu → View → Toggle Dev Tools)

**"Need to update app"**
→ Just replace the `win-unpacked/` folder with new version
→ No uninstall needed

---

## Summary

| | Chrome Extension | Desktop App |
|---|---|---|
| **Setup for you** | Load unpacked from `dist-extension/` | Run `Transcript AI.exe` |
| **No npm dev needed?** | ✅ Yes, already built | ✅ Yes, already built |
| **Share with others** | Upload to Chrome Web Store | Give them `win-unpacked/` folder |
| **What they need** | Chrome browser | Windows 10/11, internet |
| **Installation time** | 2 min (load unpacked) | 0 min (just run .exe) |

Both are **production-ready and need ZERO setup commands** to run! 🎉
