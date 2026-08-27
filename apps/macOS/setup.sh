#!/bin/bash
set -e

echo "Setting up macOS environment for Forge Wisper..."

# Install Rust if missing
if ! command -v cargo &> /dev/null; then
    echo "Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Add universal targets for macOS
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin

# Install pnpm if missing
if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi

echo "macOS setup complete!"
