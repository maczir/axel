# AXEL (Desktop Windows)

This project packages AXEL as a Windows desktop app using Electron.

## Option A — Build locally on Windows (recommended)
1) Install **Node.js LTS** (v18+).
2) Unzip this project.
3) Double-click: `build_windows.bat`
4) Your `.exe` outputs will be in the `release/` folder:
   - NSIS installer
   - Portable EXE

## Option B — Build via GitHub Actions (no local setup)
1) Push this repo to GitHub
2) Go to **Actions** → **Build Windows EXE** → **Run workflow**
3) Download the artifact **AXEL-windows-release**

## Dev mode
```bash
npm install
npm run dev
```
