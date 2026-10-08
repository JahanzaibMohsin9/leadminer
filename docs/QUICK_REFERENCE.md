# LeadMiner — Quick Command Reference

> **Fast reference for common development and deployment commands**

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

---

## 📦 Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server (frontend + Electron) |
| `npm run dev:renderer` | Start only React dev server |
| `npm run dev:main` | Compile and run only Electron main process |
| `npm run build` | Build both main process and renderer |
| `npm run build:main` | Compile TypeScript main process |
| `npm run build:renderer` | Build React app with Vite |
| `npm run build:native` | Build Rust native module |

---

## 🧪 Testing Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (Jest) |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:e2e` | Run Playwright end-to-end tests |

---

## 📦 Packaging Commands

| Command | Purpose |
|---------|---------|
| `npm run pack` | Create unpacked app directory (for testing) |
| `npm run dist` | Create installer for current platform |
| `npm run dist -- --win` | Create Windows installer (.exe) |
| `npm run dist -- --mac` | Create macOS installer (.dmg) |

---

## 🦀 Rust Commands

```bash
# Navigate to native module
cd native

# Development build
cargo build

# Production build
cargo build --release

# Run tests
cargo test

# Clean build artifacts
cargo clean

# Return to project root
cd ..
```

---

## 🛠 Common Workflows

### First-Time Setup
```bash
npm install
cd native
cargo build --release
cd ..
npm run build
npm run dev
```

### Build for Distribution
```bash
# 1. Build Rust module
npm run build:native

# 2. Build application
npm run build

# 3. Test the build
electron .

# 4. Create installer
npm run dist
```

### Reset Everything
```bash
# Clean all build artifacts
rm -rf node_modules dist out native/target

# Reinstall
npm install
cd native
cargo build --release
cd ..
```

### Debug Production Build
```bash
# Build without packaging
npm run pack

# The unpacked app will be in:
# Windows: dist/win-unpacked/
# macOS: dist/mac/LeadMiner.app/

# Run it directly
./dist/win-unpacked/LeadMiner.exe     # Windows
open dist/mac/LeadMiner.app            # macOS
```

---

## 📁 Important Paths

| Path | Description |
|------|-------------|
| `src/main/` | Electron main process (Node.js) |
| `src/renderer/` | React UI frontend |
| `src/preload/` | Electron preload scripts (IPC bridge) |
| `src/common/` | Shared TypeScript types |
| `native/` | Rust native module |
| `tests/` | All test files |
| `dist/` | Built installers (output) |
| `out/` | Compiled TypeScript (output) |

---

## 🔍 Debugging

### View Application Logs
```bash
# Windows
type %APPDATA%\LeadMiner\logs\main.log

# macOS
cat ~/Library/Logs/LeadMiner/main.log
```

### Enable Debug Mode
```bash
# Windows
set DEBUG=*
npm run dev

# macOS/Linux
export DEBUG=*
npm run dev
```

### Open DevTools in Production
Add to `src/main/main.ts`:
```typescript
mainWindow.webContents.openDevTools();
```

---

## ⚡ Performance Tips

```bash
# Rebuild native modules for Electron
npm rebuild better-sqlite3 --runtime=electron --target=28.0.0

# Clear npm cache if builds are slow
npm cache clean --force

# Update all dependencies
npm update

# Check for outdated packages
npm outdated
```

---

## 🚨 Emergency Fixes

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Rust build fails
```bash
cd native
cargo clean
rustup update
cargo build --release
cd ..
```

### Playwright browsers missing
```bash
npx playwright install chromium
```

### Electron Builder fails
```bash
# Clear Electron cache
rm -rf ~/.electron
npm install electron --force
```

---

## 📊 Pre-Release Checklist

```markdown
- [ ] `npm run build` completes successfully
- [ ] `npm test` all tests pass
- [ ] `npm run dist` creates installer
- [ ] Installer tested on clean system
- [ ] No console errors in production build
- [ ] Memory usage < 1GB during active use
- [ ] App launches in < 5 seconds
- [ ] All MVP features working
```

---

## 🎯 Platform-Specific Notes

### Windows
- Requires Visual Studio Build Tools
- Install path: `C:\Program Files\LeadMiner`
- App data: `%APPDATA%\LeadMiner`

### macOS
- Requires Xcode Command Line Tools
- App bundle: `LeadMiner.app`
- App data: `~/Library/Application Support/LeadMiner`
- First launch requires: Right-click → Open

---

For detailed instructions, see **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**
