# PersonStellations - Life Timeline Viewer

An interactive 3D visualization of life events displayed as a constellation on a globe.

## Features

- **3D Globe**: Interactive globe with geographical data showing event locations
- **Timeline Ring**: 100-year clock-style timeline with:
  - Alternating decade stripes
  - Year and age markers
  - Dynamic NOW indicator
- **Constellation Markers**: Colorful, animated star-like event markers with:
  - Rainbow color variation
  - Custom shader effects (glow, sparkle, pulse)
  - Interactive hover states
- **Surface Routing**: Smart connector lines that route around the globe
- **Multiple Biographies**: Easy switching between different life stories

## Usage

This viewer loads `bios_manifest.json` via `fetch()`, so it’s best run from a local HTTP server (not `file://`).

### Option A: VS Code Live Server

If you use VS Code, the **Live Server** extension is the simplest option.

### Option B: Python (built-in)

From the repo root:

```powershell
cd C:\github\centropa
python -m http.server 8000
```

Then open:

- http://localhost:8000/

> Important: serve the **repo root folder** (the folder that contains
> `index.html` and the `data/` and `assets/` directories). If you start a
> server in a different folder, the app may show UI overlays but fail to load
> the 3D models.

### Option C: Node.js (one-liner)

```bash
npx serve
```

Then open the printed URL (it should serve the repo root).

### Controls

- **Left Click + Drag**: Rotate the globe
- **Right Click + Drag**: Pan the view
- **Mouse Wheel**: Zoom in/out
- **Hover**: See event details in tooltips
- **Dropdown Menu**: Switch between different biographies

## File Structure

```
./
├── index.html              # Main viewer application
├── assets/
│   ├── main.js             # Application logic
│   └── styles.css          # Styling
├── data/
│   ├── bios_manifest.json  # Biography list
│   ├── edith-umova.glb     # Biography 1 (3D model + events)
│   ├── michal-warzager.glb # Biography 2 (3D model + events)
│   └── stanislaw-wierzba.glb # Biography 3 (3D model + events)
├── README.md               # Documentation
├── CLAUDE.md               # Claude Code instructions
└── letter.md               # Delivery letter for GLB files
```

## Technical Details

- Built with **Three.js** for 3D rendering
- Custom GLSL shaders for star effects
- Post-processing with bloom effects
- Pure HTML/CSS/JavaScript (no build process required)
- CDN resources for Three.js libraries

## Browser Requirements

- Modern browser with WebGL support
- Recommended: Latest Chrome, Firefox, or Edge

## License

Personal project - all rights reserved.

---

Enjoy exploring life stories in 3D! ✨
