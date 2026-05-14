# Production Deployment Guide

## Chrome Extension Setup

### Load Extension for Testing
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Navigate to: `transcript-ai/dist-extension/`
5. Select the folder and load it

### Test the Extension
1. Go to any YouTube video page
2. Click the **Transcript AI** extension icon in the toolbar
3. A side panel should appear with the video detected
4. Click **Open** to see the full app or use transcript features directly

### Deploy to Chrome Web Store (Future)
1. Zip the contents of `dist-extension/` folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload the zip file
4. Fill in store listing details and publish

## Desktop App Setup

### Run Desktop App (Windows)
1. Navigate to: `transcript-ai/release/win-unpacked/`
2. Double-click **Transcript AI.exe** to run the application
3. The app will open with full functionality

### Test the Desktop App
1. Open a YouTube video URL in the app
2. Test transcript extraction
3. Test summarization
4. Test chat features
5. Verify all features work without errors

### Create Windows Installer (Optional)
If you need a proper NSIS installer in the future:
```bash
npm run desktop:dist
```
Note: May require running PowerShell as Administrator or adjusting UAC settings due to code signing requirements.

## Production URLs Configuration

Both platforms are now configured to use:
```
https://ai-transcript.netlify.app
```

This URL is set in `.env.production` and used for:
- ✅ Chrome Extension: Side panel communication and API calls
- ✅ Desktop App: Electron app API calls  
- ✅ Web App: Uses relative URLs (unchanged)

## Troubleshooting

### Extension fails with "Connection refused"
**Solution**: Verify `dist-extension/manifest.json` has:
```json
"host_permissions": [
  "https://ai-transcript.netlify.app/*"
]
```

### Desktop app shows blank screen
**Solution**: Check browser console in dev tools (Menu > View > Toggle Dev Tools)
Look for API errors - they indicate the Netlify functions aren't responding correctly

### API calls return 401 errors
**Solution**: Verify Clerk authentication is working:
- Check `.env.production` has correct `VITE_CLERK_PUBLISHABLE_KEY`
- Verify user is logged in

## Future Updates

### Rebuilding for Production Changes
When you update code and need to rebuild:

```bash
# Extension
NODE_ENV=production npm run extension:build

# Desktop
NODE_ENV=production npm run desktop:build
```

### Development vs Production
- **Development**: Use `npm run dev` (uses localhost:8888)
- **Production**: Use NODE_ENV=production before running build scripts

## Files Changed
- `.env.production` - Added production URLs for extension/desktop
- `scripts/generate-extension-manifest.mjs` - Now reads from .env.production in production
- `extension/public/manifest.json` - Generated with production URLs (rebuild required to update)

## Next Steps
1. ✅ Test Chrome extension in Chrome
2. ✅ Test desktop app by running Transcript AI.exe
3. Optionally publish extension to Chrome Web Store
4. Optionally create NSIS installer for Windows distribution
