#!/bin/bash
set -e

echo "Building Forge Wisper for macOS..."

# Navigate to the desktop app where Tauri is configured
cd ../desktop

# Build the Tauri application for macOS
pnpm tauri build --target universal-apple-darwin

echo "Build complete. App bundle generated in apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/macos/"
