# LeadMiner Desktop — Complete Deployment & Setup Guide

> **Complete guide for deploying, setting up, and testing LeadMiner Desktop**

This guide will walk you through the entire process of setting up the development environment, building the application, creating distributable packages, and testing the application thoroughly.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Initial Setup](#-initial-setup)
3. [Development Environment](#-development-environment)
4. [Building the Rust Native Module](#-building-the-rust-native-module)
5. [Building the Application](#-building-the-application)
6. [Creating Distributable Packages](#-creating-distributable-packages)
7. [Testing Guide](#-testing-guide)
8. [Troubleshooting](#-troubleshooting)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

#### For All Platforms

- **Node.js** (v18+ recommended)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
  - NPM should be included: `npm --version`

- **Git**
  - Download from: https://git-scm.com/
  - Verify: `git --version`

#### For Rust Native Module

- **Rust** (latest stable)
  - Download from: https://rustup.rs/
  - Verify: `rustc --version` and `cargo --version`
  - Run `rustup update` to ensure latest version

#### Windows-Specific

- **Visual Studio Build Tools 2019 or later**
  - Download: https://visualstudio.microsoft.com/downloads/
  - Install "Desktop development with C++" workload
  - Required for native Rust compilation

- **Windows SDK**
  - Usually included with Visual Studio Build Tools

#### macOS-Specific

- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

- **For code signing (production builds)**
  - Apple Developer account
  - Valid Developer ID Application certificate

### System Requirements

- **RAM**: Minimum 8GB (16GB recommended)
- **Disk Space**: At least 5GB free
- **OS Versions**:
  - Windows: Windows 10 or later (64-bit)
  - macOS: macOS 10.15 (Catalina) or later

---

## 🚀 Initial Setup

### 1. Clone the Repository

```bash
# If using Git
git clone <your-repository-url>
cd leadMiner

# Or navigate to your existing directory
cd d:\leadMiner
```

### 2. Install Node Dependencies

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- Electron
- React and React DOM
- Playwright (browser automation)
- Better-SQLite3 (local database)
- XLSX (Excel export)
- Development tools (TypeScript, Vite, Jest, etc.)

> **⏱ Expected time**: 2-5 minutes depending on your internet connection

### 3. Verify Installation

```bash
# Check that key dependencies are installed
npm list react electron playwright
```

You should see version numbers for each package without errors.

---

## 💻 Development Environment

### Running in Development Mode

The application uses a dual-process development setup:

```bash
npm run dev
```

This command:
1. Starts the Vite development server for the React frontend (port 5173)
2. Compiles the TypeScript main process code
3. Launches Electron with hot-reload enabled

**What to expect:**
- A terminal window showing both Vite and Electron logs
- The LeadMiner application window opens
- Changes to React code (`src/renderer/**`) will hot-reload
- Changes to main process code (`src/main/**`) require restart

### Development Scripts

```bash
# Run only the renderer (React UI) development server
npm run dev:renderer

# Compile and run only the main process
npm run dev:main

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests with Playwright
npm run test:e2e
```

### Folder Structure Overview

```
leadMiner/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Application entry point
│   │   ├── scraping/   # Browser automation logic
│   │   ├── processing/ # Data processing
│   │   ├── storage/    # Database operations
│   │   └── export/     # CSV/Excel export
│   ├── renderer/       # React frontend
│   │   ├── App.tsx     # Main React component
│   │   └── components/ # UI components
│   ├── preload/        # Electron preload scripts
│   └── common/         # Shared types and utilities
├── native/             # Rust native module
│   ├── src/
│   └── Cargo.toml
├── tests/              # Test files
├── dist/               # Built application (output)
└── out/                # Compiled TypeScript (output)
```

---

## 🦀 Building the Rust Native Module

The Rust module handles job orchestration, rate limiting, and license validation.

### 1. Navigate to Native Directory

```bash
cd native
```

### 2. Build the Native Module

```bash
# Development build (faster)
cargo build

# Production build (optimized)
cargo build --release
```

Or use the NPM script from the root directory:

```bash
cd ..
npm run build:native
```

### 3. Verify the Build

The compiled module should appear at:
- Windows: `native/index.win32-x64-msvc.node`
- macOS: `native/index.darwin-x64.node` or `native/index.darwin-arm64.node`

### 4. Test the Module

```bash
node -e "const native = require('./native'); console.log('Rust module loaded successfully!');"
```

If successful, you should see: "Rust module loaded successfully!"

---

## 🔨 Building the Application

### Full Build Process

Build both the main process and renderer:

```bash
npm run build
```

This executes:
1. `npm run build:main` - Compiles TypeScript main process → `out/main/`
2. `npm run build:renderer` - Builds React app with Vite → `dist/`

### Verify the Build

Check that the following directories exist and contain files:
- `out/main/main/main.js` - Main process entry point
- `dist/index.html` - Renderer HTML
- `dist/assets/` - Bundled JS and CSS

### Test the Build Locally

```bash
# Run the built application (not packaged yet)
electron .
```

The application should launch using the compiled code from `out/` and `dist/`.

---

## 📦 Creating Distributable Packages

### Configuration

The build configuration is in `electron-builder.json`:

```json
{
  "appId": "com.leadminer.app",
  "productName": "LeadMiner",
  "directories": {
    "output": "dist",
    "buildResources": "build"
  },
  "files": [
    "out/**/*",
    "dist/**/*",
    "native/**/*.node",
    "package.json"
  ],
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "mac": {
    "target": ["dmg"],
    "icon": "build/icon.icns",
    "category": "public.app-category.business"
  }
}
```

### Build Installers

#### Windows Installer (.exe)

```bash
npm run dist
```

This creates:
- `dist/LeadMiner Setup 1.0.0.exe` - NSIS installer
- `dist/win-unpacked/` - Unpacked application files

**Installer Features:**
- One-click installation to Program Files
- Desktop shortcut option
- Start Menu entry
- Uninstaller

#### macOS Installer (.dmg)

```bash
npm run dist
```

This creates:
- `dist/LeadMiner-1.0.0.dmg` - Drag-to-Applications installer
- `dist/mac/` - Application bundle

### Build for Specific Platform

```bash
# Windows only
npm run dist -- --win

# macOS only
npm run dist -- --mac

# Create directory output (unpacked, for testing)
npm run pack
```

### Code Signing

#### Windows Code Signing

1. Obtain a code signing certificate (e.g., from DigiCert, Sectigo)
2. Set environment variables:
   ```bash
   set CSC_LINK=C:\path\to\certificate.pfx
   set CSC_KEY_PASSWORD=your-certificate-password
   ```
3. Run build:
   ```bash
   npm run dist
   ```

#### macOS Code Signing & Notarization

1. Ensure you have a valid Developer ID Application certificate
2. Set environment variables:
   ```bash
   export APPLE_ID=your-apple-id@example.com
   export APPLE_ID_PASSWORD=app-specific-password
   export APPLE_TEAM_ID=your-team-id
   ```
3. Build automatically signs and notarizes:
   ```bash
   npm run dist
   ```

> **Note**: macOS notarization is required for distribution outside the Mac App Store.

---

## 🧪 Testing Guide

### Pre-Testing Checklist

- [ ] Application builds without errors
- [ ] Rust native module compiles successfully
- [ ] All dependencies installed
- [ ] Test data/scenarios prepared

### 1. Unit Tests

Test individual functions and components:

```bash
npm run test:unit
```

**What's tested:**
- Data processing logic (deduplication, normalization)
- Email extraction patterns
- Phone number formatting
- Utility functions

**Expected output:**
```
PASS  tests/unit/processing.test.ts
PASS  tests/unit/validation.test.ts
✓ All tests passed
```

### 2. Integration Tests

Test interactions between components:

```bash
npm run test:integration
```

**What's tested:**
- IPC communication between renderer and main process
- Database operations (create, read, update, delete)
- File export functionality
- Settings persistence

### 3. End-to-End Tests

Test complete user workflows:

```bash
npm run test:e2e
```

**What's tested:**
- Application launch and shutdown
- UI interactions (button clicks, form inputs)
- Scraping workflow (mock data)
- Export functionality

**Playwright test locations:**
- `tests/e2e/app.spec.ts` - Application lifecycle
- `tests/e2e/scraping.spec.ts` - Scraping workflows
- `tests/e2e/export.spec.ts` - Export functionality

### 4. Manual Testing Scenarios

#### Scenario 1: Small Lead Collection (50 leads)

**Objective**: Verify stable operation for small datasets

1. Launch the application
2. Enter search parameters:
   - Keyword: "coffee shop"
   - City: "Seattle, WA"
3. Select speed: "Normal"
4. Click "Start Collection"
5. Monitor the live results table
6. Stop after ~50 results or automatic completion
7. Export to CSV
8. Open CSV in Excel/Google Sheets

**Expected Results:**
- [ ] No crashes or freezes
- [ ] Progress indicator updates smoothly
- [ ] Results appear in real-time
- [ ] CSV exports successfully
- [ ] Data contains: name, phone, website, address
- [ ] No duplicate entries

**⏱ Expected time**: 1-2 minutes

#### Scenario 2: Large Lead Collection (500+ leads)

**Objective**: Stress test for larger datasets

1. Launch the application
2. Enter search parameters:
   - Keyword: "restaurant"
   - City: "Los Angeles, CA"
3. Select speed: "Fast"
4. Click "Start Collection"
5. Let it run until 500+ results
6. Export to Excel

**Expected Results:**
- [ ] Application remains responsive
- [ ] Memory usage stays reasonable (<1GB)
- [ ] Export completes successfully
- [ ] File opens without corruption

**⏱ Expected time**: 5-10 minutes

#### Scenario 3: Email Discovery

**Objective**: Test website email extraction

1. Collect leads with websites
2. Observe email extraction in real-time
3. Verify emails in exported data

**Expected Results:**
- [ ] Valid email addresses extracted
- [ ] No broken URLs cause crashes
- [ ] Missing emails marked appropriately

#### Scenario 4: Network Failure Handling

**Objective**: Test resilience to network issues

1. Start collection
2. Disable network connection mid-process
3. Re-enable network
4. Observe application behavior

**Expected Results:**
- [ ] Application doesn't crash
- [ ] Clear error message displayed
- [ ] Can retry or resume

#### Scenario 5: Speed Control Testing

**Objective**: Verify rate limiting works

1. Test each speed setting (Slow, Normal, Fast)
2. Observe timing between requests
3. Check for captcha warnings

**Expected Results:**
- [ ] Slow: 3-5 second delays
- [ ] Normal: 1-2 second delays
- [ ] Fast: <1 second delays
- [ ] Warning appears if captcha detected

#### Scenario 6: Data Deduplication

**Objective**: Verify duplicate removal

1. Run same search twice
2. Don't clear results between runs
3. Export data

**Expected Results:**
- [ ] Phone duplicates removed
- [ ] Domain duplicates removed
- [ ] Count reflects unique entries

### 5. Installation Testing

#### Windows

1. Run the installer: `LeadMiner Setup 1.0.0.exe`
2. Complete installation wizard
3. Launch from Desktop shortcut
4. Verify installation path: `C:\Program Files\LeadMiner`
5. Test application functionality
6. Uninstall from Windows Settings → Apps
7. Verify clean removal

#### macOS

1. Open `LeadMiner-1.0.0.dmg`
2. Drag to Applications folder
3. Launch from Applications
4. Handle Gatekeeper warning (first launch)
5. Test application functionality
6. Delete from Applications folder

### 6. Performance Benchmarks

Run these to establish baseline performance:

```bash
# Memory usage
# While app is running, check Task Manager (Windows) or Activity Monitor (macOS)
# Expected: <500MB idle, <1GB during active scraping

# Startup time
# Measure time from launch to UI ready
# Expected: <5 seconds on modern hardware

# Export speed
# Time to export 1000 records to CSV
# Expected: <3 seconds
```

### Test Data Reset

Between test runs, you may need to clear data:

```bash
# Delete the database
# Windows: %APPDATA%\LeadMiner\leads.db
# macOS: ~/Library/Application Support/LeadMiner/leads.db

# Or use the built-in "Clear All Results" button in the app
```

---

## 🔥 Troubleshooting

### Common Issues

#### "Module not found" errors during build

**Problem**: Dependencies not installed correctly

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Rust native module fails to load

**Problem**: Architecture mismatch or missing build

**Solution**:
```bash
cd native
cargo clean
cargo build --release
cd ..
npm run build:native
```

#### Playwright browser not downloading

**Problem**: Network issues or missing browsers

**Solution**:
```bash
npx playwright install chromium
```

#### Electron Builder fails on Windows

**Problem**: Missing Visual Studio Build Tools

**Solution**:
- Install Visual Studio Build Tools 2019+
- Include "Desktop development with C++" workload
- Restart terminal/IDE

#### "Cannot find module 'better-sqlite3'" in packaged app

**Problem**: Native module not included in bundle

**Solution**:
- Ensure `electron-builder.json` includes native modules in `files` array
- Rebuild better-sqlite3 for Electron:
  ```bash
  npm rebuild better-sqlite3 --runtime=electron --target=28.0.0 --disturl=https://electronjs.org/headers
  ```

#### Application crashes on macOS due to Gatekeeper

**Problem**: App not signed/notarized

**Solution**:
- Right-click → Open (first launch)
- Or: System Preferences → Security & Privacy → "Open Anyway"
- For distribution: Properly sign and notarize

#### High memory usage during scraping

**Problem**: Browser context not being cleaned up

**Solution**:
- Check `src/main/scraping/` for proper browser.close() calls
- Limit concurrent pages
- Add periodic memory cleanup

### Debugging

If you encounter issues not covered here:

1. Check logs:
   - Windows: `%APPDATA%\LeadMiner\logs\`
   - macOS: `~/Library/Logs/LeadMiner/`

2. Enable debug mode:
   ```bash
   set DEBUG=* (Windows)
   export DEBUG=* (macOS/Linux)
   npm run dev
   ```

3. Open a GitHub issue with the logs, OS version and error message.

---

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Builder Guide](https://www.electron.build/)
- [Playwright Documentation](https://playwright.dev/)
- [React Documentation](https://react.dev/)
- [Rust Documentation](https://doc.rust-lang.org/)
