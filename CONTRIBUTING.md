# Contributing to Forge Wisper

Thank you for your interest in contributing to **Forge Wisper**!

## Development Sequence

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```
2. Build and run tests:
   ```bash
   cargo test --workspace
   ```
3. Run the desktop application in development mode:
   ```bash
   pnpm tauri:dev
   ```

## Pull Request Guidelines

- Follow existing code style and formatting standards (`cargo fmt`, `pnpm lint`).
- Ensure all tests pass (`cargo test --workspace`).
- Add tests for any new rules, cleanup algorithms, or verification checks.
- Keep commits descriptive and scoped.
