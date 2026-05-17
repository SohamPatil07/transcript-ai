#!/bin/bash

# Production Build & Deployment Script for Transcript AI
# This script builds everything needed for production deployment

set -e

echo "🚀 Transcript AI - Production Build Script"
echo "=========================================="
echo ""

# Step 1: Check environment
echo "1️⃣  Checking environment..."
if [ ! -f ".env.production" ]; then
  echo "❌ Error: .env.production not found"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found (not in project root)"
  exit 1
fi

echo "✓ Environment files found"
echo ""

# Step 2: Build web app
echo "2️⃣  Building web app..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ Web app built successfully"
  echo "   Output: dist/"
else
  echo "❌ Web app build failed"
  exit 1
fi
echo ""

# Step 3: Build extension
echo "3️⃣  Building extension for production..."
NODE_ENV=production npm run extension:build
if [ $? -eq 0 ]; then
  echo "✓ Extension built successfully"
  echo "   Output: dist-extension/"
else
  echo "❌ Extension build failed"
  exit 1
fi
echo ""

# Step 4: Verify extension manifest
echo "4️⃣  Verifying extension manifest..."
if grep -q "https://ai-transcript.netlify.app" dist-extension/manifest.json; then
  echo "✓ Production URL found in manifest CSP"
else
  echo "⚠️  Warning: Production URL not in manifest"
  echo "   Check that .env.production has VITE_EXTENSION_APP_URL set"
fi
echo ""

# Step 5: Create extension zip
echo "5️⃣  Creating extension package..."
rm -f transcript-ai-extension.zip
cd dist-extension
zip -r ../transcript-ai-extension.zip . > /dev/null 2>&1
cd ..
echo "✓ Extension packaged: transcript-ai-extension.zip"
echo ""

# Step 6: Summary
echo "=========================================="
echo "✅ Production Build Complete!"
echo "=========================================="
echo ""
echo "📦 Deployment Artifacts:"
echo "   - Web app: dist/"
echo "   - Extension zip: transcript-ai-extension.zip"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "   For Web App (Netlify):"
echo "   1. Verify env vars in Netlify dashboard:"
echo "      - CLERK_SECRET_KEY"
echo "      - APIFY_TOKEN"
echo "      - GROQ_API_KEY"
echo "   2. Deploy: git push origin main"
echo "   3. Or: npx netlify deploy --prod --dir=dist"
echo ""
echo "   For Chrome Extension:"
echo "   1. Go to: chrome://extensions/"
echo "   2. Enable \"Developer mode\""
echo "   3. \"Load unpacked\" → select dist-extension/"
echo "   4. Test on YouTube video"
echo "   5. Upload transcript-ai-extension.zip to Chrome Web Store"
echo ""
echo "📚 Documentation:"
echo "   - Chrome Web Store: CHROME_WEB_STORE_DEPLOYMENT.md"
echo "   - Web App: WEB_APP_PRODUCTION_DEPLOYMENT.md"
echo "   - Production Issues: PRODUCTION_ISSUES_AND_FIXES.md"
echo ""
