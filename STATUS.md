# Repository Status

The AXEL desktop sources are now present under `AXEL_DESKTOP/`, and core fixes have been applied:
- Macro RRUs now allow multi-sector loading (up to three 2x2 sectors per 6-port unit).
- Bay stacking accounts for the tallest element (chassis and left/right RRU columns) so subsequent bays shift down automatically.
- Exports use an SVG-first pipeline with Electron save dialogs (and browser fallback) for PNG/PDF/PPTX; html2canvas has been removed.
- Electron preload/main expose a native `saveFile` helper for consistent downloads.

## Remaining follow-ups
- Confirm Free logo placement (UI vs. export) and add assets if required.
- Optional: add a drag-and-drop layout edit mode atop the current controlled bay reordering.
- Run full build/test passes once dependencies are installed (`cd AXEL_DESKTOP && npm install`).
