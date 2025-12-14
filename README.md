# AXEL

The AXEL desktop application source is now available under `./AXEL_DESKTOP`. Core fixes have been applied for constrained bay stacking, macro RRH sector allocation, and a more reliable export pipeline (SVG-first with Electron save dialogs and browser fallback). Refer to `PLAN.md` for the broader implementation blueprint.

## Structure
- `AXEL_DESKTOP/` – React/Electron source (App, DiagramCanvas, export utilities, Electron main/preload, etc.).
- `PLAN.md` – Implementation blueprint.
- `STATUS.md` – Progress tracker for requested fixes.

## Next steps
1. Install dependencies (`cd AXEL_DESKTOP && npm install`).
2. Run in development: `npm run dev`.
3. Build desktop artifacts: `npm run dist:win` (requires Windows build environment).

## Where to find/download the modified files
- **Location:** All updated source files live in the `AXEL_DESKTOP/` folder (React/Electron app, including `App.tsx`, `DiagramCanvas.tsx`, `utils/exporter.ts`, `electron/main.cjs`, etc.).
- **Git download:** From this repository root you can grab everything (including the modifications) with `git clone <repo-url>` or create an archive with `git archive -o axel_latest.zip HEAD`.
- **File-by-file download:** On GitHub, open any file under `AXEL_DESKTOP/` and use the **Download raw file** option; repeat for each file you need.
