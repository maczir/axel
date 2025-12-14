# AXEL Feature Integration Plan

This repository does not currently include the application source that powers the AXEL desktop app referenced in the latest user request. To avoid blocking work, this plan captures the concrete implementation steps needed once the source is available. It is organized by feature so it can be applied directly to the missing files.

## 1) Constrained block mobility ("réorganisable mais pas n'importe comment")
- Add an **Edit Layout** mode that enables reordering of bays (AMIA) as a vertical sortable list; disable X-axis moves to keep layouts clean.
- Implement bay reordering via a swap-based sortable list (e.g., `@dnd-kit/sortable`), keeping radios attached to their bay IDs and recalculating stacked Y positions from ordered bay heights plus gaps.
- Optional: fine-tune radio Y offsets inside each bay while locking X to rails and enforcing snap + anti-overlap.

## 2) Macro RRH capacity per sector
- Update macro site assignment so a single RRH (6 RF ports) can serve up to **3 sectors** in 2x2 MIMO (2 ports per sector), 1 sector for 4x4, and continue filling micros by capacity.
- Use derived sector capacity: `maxSectors = min(3, Math.floor(rfPorts / portsPerSector))` for macro profiles; assign sectors accordingly instead of a strict 1:1 mapping.

## 3) Layout alignment for subsequent bays
- When stacking bays, compute each bay group's height as the maximum of: chassis+externals, left RRUs column, and right RRUs column. Stack cumulative heights so downstream bays shift down to clear tall RRU columns.

## 4) Reliable export (PNG/PDF) in Electron
- Prefer SVG-first export: serialize the diagram SVG with inline styles, draw onto a canvas, then save via `canvas.toBlob()`.
- In Electron builds, route saves through `ipcRenderer` / `ipcMain` using `dialog.showSaveDialog()` to avoid browser download limitations; provide a browser fallback for web builds.
- Optionally add a dedicated print window for vector PDF export via `webContents.printToPDF()`.

## 5) Free logo handling
- Confirm whether the logo must appear in-app, in exports, or both. For exports, embed the logo SVG in the serialized diagram or add a cover/header layer before rendering.

## Next steps
Once the application source is present, apply these changes to the corresponding files (e.g., `App.tsx`, `DiagramCanvas.tsx`, `utils/exporter.ts`, `electron/main.cjs`, `electron/preload.cjs`) following the above blueprint.
