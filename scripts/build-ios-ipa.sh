#!/usr/bin/env bash
# Gera o .ipa do CliniEvo para iOS.
# Rodar no Mac: chmod +x scripts/build-ios-ipa.sh && ./scripts/build-ios-ipa.sh

set -e
cd "$(dirname "$0")/.."

echo "→ Build web..."
npm run build

echo "→ Sync Capacitor iOS..."
npx cap sync ios

BUILD_DIR="$(pwd)/build"
ARCHIVE_PATH="$BUILD_DIR/CliniEvo.xcarchive"
EXPORT_PATH="$BUILD_DIR/ipa"
EXPORT_PLIST="$(pwd)/scripts/ExportOptions.plist"

mkdir -p "$BUILD_DIR"

echo "→ Archive (Xcode)..."
cd ios/App
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  archive

echo "→ Export .ipa..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST"

echo ""
echo "✓ .ipa gerado em: $EXPORT_PATH"
ls -la "$EXPORT_PATH"/*.ipa 2>/dev/null || true
