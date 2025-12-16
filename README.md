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

Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari).

### Controls

- **Left Click + Drag**: Rotate the globe
- **Right Click + Drag**: Pan the view
- **Mouse Wheel**: Zoom in/out
- **Hover**: See event details in tooltips
- **Dropdown Menu**: Switch between different biographies

## File Structure

```
dist/
├── index.html              # Main viewer application
├── bios_manifest.json      # Biography list
├── edith-umova.glb         # Biography 1 (3D model + events)
├── michal-warzager.glb     # Biography 2 (3D model + events)
└── stanislaw-wierzba.glb   # Biography 3 (3D model + events)
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
