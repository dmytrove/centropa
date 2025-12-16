import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';


// --- Configuration ---
const LABEL_PADDING = 10;
const LABEL_WIDTH_EST = 200;
const LABEL_HEIGHT_EST = 60;

// --- Status Overlay ---
const statusOverlay = document.getElementById('status-overlay');
function setStatus(message, { kind = 'info', persist = true } = {}) {
    if (!statusOverlay) return;
    statusOverlay.classList.toggle('error', kind === 'error');
    statusOverlay.innerHTML = message;
    statusOverlay.style.display = message ? 'block' : 'none';

    // Optional auto-hide for non-persistent info messages.
    if (!persist && message) {
        window.clearTimeout(setStatus._t);
        setStatus._t = window.setTimeout(() => {
            statusOverlay.style.display = 'none';
        }, 2500);
    }
}

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510); // Deep space dark blue/black

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 350);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// High DPR can be very expensive for a full-screen WebGL canvas.
// Cap to keep GPU cost under control while still looking sharp.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
// r152+ uses outputColorSpace instead of outputEncoding.
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Ensure we always clear to a known color; avoids odd compositing artifacts.
renderer.setClearColor(0x05030D, 1);
document.getElementById('container').appendChild(renderer.domElement);

renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setStatus('<strong>WebGL context lost</strong>. Try reloading the page.', { kind: 'error', persist: true });
});

// --- Post Processing (Bloom/Glow) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.85);
bloomPass.threshold = 0.85;
bloomPass.strength = 0.5;
bloomPass.radius = 0.4;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const USE_POSTPROCESSING = true;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(100, 100, 100);
scene.add(sunLight);

// Nebula palette accent light (teal)
const fillLight = new THREE.DirectionalLight(0x38d6c8, 1.0);
fillLight.position.set(-100, -50, -100);
scene.add(fillLight);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.zoomSpeed = 0.2;
controls.rotateSpeed = 0.4;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15; // Base slow rotation (Majestic)
controls.minDistance = 110;
controls.maxDistance = 800;

// --- Interaction-driven animation tuning ---
// Smoothly modulate auto-rotate and bloom based on whether a pin/label is hovered.
const AUTO_ROTATE_BASE = 0.15;
const AUTO_ROTATE_HOVER = 0.02;
let _autoRotateCurrent = AUTO_ROTATE_BASE;

const BLOOM_BASE = 0.5;
const BLOOM_HOVER = 0.7;
let _bloomCurrent = BLOOM_BASE;

// Subtle idle "breathing" (kept tiny to avoid motion sickness).
const BREATH_AMPLITUDE = 0.015;
const BREATH_SPEED = 0.35;

// --- Stellar Visuals ---
function addStars() {
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 2000;
    const posArray = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 2000;
        posArray[i + 1] = (Math.random() - 0.5) * 2000;
        posArray[i + 2] = (Math.random() - 0.5) * 2000;
    }

    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({
        size: 2,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);
}
addStars();

// Cache constants
const GRID_RADIUS = 100.5;
const LAT_SEGMENTS = 18;
const LON_SEGMENTS = 24;

function createLatLonGrid() {
    const radius = GRID_RADIUS;
    const latSegments = LAT_SEGMENTS;
    const lonSegments = LON_SEGMENTS;
    const vertices = [];
    // Store each segment as 2 endpoints so we can decide (per frame) whether
    // it belongs to the globe's visible (front-facing) hemisphere.
    const segments = [];

    // Latitudes (Rings)
    for (let i = 1; i < latSegments; i++) {
        const phi = (i / latSegments) * Math.PI;
        const y = radius * Math.cos(phi);
        const r = radius * Math.sin(phi);
        // Loop
        let prev = null;
        for (let j = 0; j <= 64; j++) {
            const theta = (j / 64) * Math.PI * 2;
            const p = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
            if (prev) {
                vertices.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                segments.push({ a: prev.clone(), b: p.clone() });
            }
            prev = p;
        }
    }

    // Longitudes (Meridians)
    for (let i = 0; i < lonSegments; i++) {
        const theta = (i / lonSegments) * Math.PI * 2;
        let prev = null;
        for (let j = 0; j <= 32; j++) {
            const phi = (j / 32) * Math.PI;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            const p = new THREE.Vector3(x, y, z);
            if (prev) {
                vertices.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                segments.push({ a: prev.clone(), b: p.clone() });
            }
            prev = p;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    // Per-vertex alpha so we can hide back-facing segments.
    const alpha = new Float32Array((vertices.length / 3) * 1);
    alpha.fill(1);
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

    // Dim lines
    // IMPORTANT:
    // The grid is attached to the globe mesh, so we want it to be occluded by the globe surface.
    // If depthTest is disabled (or blending/depth settings are off), you can see a "pole-to-pole axis"
    // line shining through the sphere.
    // Use a custom shader so we can multiply opacity by our per-vertex alpha.
    // This lets us fully hide the back hemisphere (the source of the pole-to-pole "axis" line).
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0x38d6c8) },
            uOpacity: { value: 0.07 }
        },
        vertexShader: `
            precision mediump float;
            attribute float alpha;
            varying float vAlpha;
            void main() {
                vAlpha = alpha;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision mediump float;
            uniform vec3 uColor;
            uniform float uOpacity;
            varying float vAlpha;
            void main() {
                float a = clamp(uOpacity * vAlpha, 0.0, 1.0);
                if (a <= 0.001) discard;
                gl_FragColor = vec4(uColor, a);
            }
        `,
        transparent: true,
        blending: THREE.NormalBlending,
        // Draw as an underlay (always behind the globe surface).
        // Depth test off keeps the grid from ever appearing "on top" of the earth.
        // We still rely on our back-hemisphere fade to prevent the pole-to-pole inner line.
        depthTest: false,
        depthWrite: false
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;

    // Subtle "glow" pass: slightly thicker, very low opacity, additive.
    // Keeping depthTest on prevents it from glowing through the globe interior.
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0x38d6c8) },
            uOpacity: { value: 0.06 }
        },
        vertexShader: material.vertexShader,
        fragmentShader: material.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
    });
    const glowLines = new THREE.LineSegments(geometry, glowMaterial);
    glowLines.frustumCulled = false;

    // Make the glow a touch thicker than the core line.
    // Note: linewidth support is platform-dependent (often ignored), but keeping it is harmless.
    glowMaterial.linewidth = 2;

    const group = new THREE.Group();
    group.add(glowLines);
    group.add(lines);

    // Ensure the underlay grid draws before the land mesh (land is 0).
    group.renderOrder = -1;

    // Attach data for per-frame visibility updates.
    group.userData._segments = segments;
    group.userData._radius = radius;
    group.userData._gridParts = { core: lines, glow: glowLines };
    return group;
}

function updateLatLonGridVisibility(gridLines) {
    if (!gridLines || !gridLines.geometry) return;
    // Grid may be a Group (core + glow) or a single LineSegments.
    const target = gridLines.isGroup && gridLines.userData && gridLines.userData._gridParts
        ? gridLines.userData._gridParts.core
        : gridLines;

    if (!target || !target.geometry) return;

    const segments = gridLines.userData && gridLines.userData._segments;
    if (!segments || segments.length === 0) return;

    const geo = target.geometry;
    const alphaAttr = geo.getAttribute('alpha');
    if (!alphaAttr) return;

    // Camera direction in the grid's local/object space.
    const camWorld = _scratchWorldPos;
    camera.getWorldPosition(camWorld);
    const camLocal = camWorld.clone();
    gridLines.worldToLocal(camLocal);
    if (camLocal.lengthSq() > 0) camLocal.normalize();

    const a = alphaAttr.array;

    // Each segment corresponds to 2 vertices (and thus 2 alpha entries).
    // We fade segments only when they're clearly on the far (back) hemisphere.
    // This keeps the grid feeling like it wraps the globe, while preventing the
    // back-side meridian from reading as a pole-to-pole "axis" inside the sphere.
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const mx = (seg.a.x + seg.b.x) * 0.5;
        const my = (seg.a.y + seg.b.y) * 0.5;
        const mz = (seg.a.z + seg.b.z) * 0.5;
        const len = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
        const nx = mx / len;
        const ny = my / len;
        const nz = mz / len;

        // Dot > 0 => facing camera hemisphere.
        const d = nx * camLocal.x + ny * camLocal.y + nz * camLocal.z;

        // Smooth fade only for the far backside.
        // Keep fully visible through the limb and most of the back, then fade out.
        // Visible when d >= -0.65, invisible when d <= -0.95.
        const vis = THREE.MathUtils.smoothstep(d, -0.95, -0.65);

        const idx = i * 2;
        a[idx] = vis;
        a[idx + 1] = vis;
    }

    alphaAttr.needsUpdate = true;
}

// --- Animation Globals ---
let mixer;
const clock = new THREE.Clock();
let pins = [];
let currentModel = null;
const labelsLayer = document.getElementById('labels-layer');
const svgLayer = document.getElementById('svg-layer');

// Lat/Lon grid reference (for view-dependent hiding of back hemisphere)
let latLonGrid = null;

// Scratch objects to reduce per-frame allocations.
const _scratchWorldPos = new THREE.Vector3();
const _scratchCamToPin = new THREE.Vector3();
const _scratchPinNormal = new THREE.Vector3();

// --- Resource Management ---
const textureProps = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap', 'specularMap'];

function disposeMaterial(material) {
    if (!material) return;

    for (const prop of textureProps) {
        const tex = material[prop];
        if (tex && typeof tex.dispose === 'function') {
            tex.dispose();
        }
    }

    if (typeof material.dispose === 'function') material.dispose();
}

function disposeObject3D(root) {
    if (!root) return;
    root.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial);
            else disposeMaterial(obj.material);
        }
    });
}

// --- Interaction State ---
let hoveredPinIndex = -1;

// --- Performance ---
// Rebuilding the SVG markup each frame is expensive. Keep 3D rendering at full FPS,
// but throttle label/SVG updates to a reasonable rate.
const LABEL_UPDATE_FPS = 30;
const LABEL_UPDATE_INTERVAL = 1 / LABEL_UPDATE_FPS;
let _labelUpdateAccumulator = 0;

// SVG Event Delegation (for dots)
svgLayer.addEventListener('mousemove', (e) => {
    const target = e.target;
    if (target && target.classList.contains('interactive-dot')) {
        const idx = parseInt(target.dataset.index);
        if (!isNaN(idx)) {
            hoveredPinIndex = idx;
            document.body.style.cursor = 'pointer';
            return;
        }
    }
});

svgLayer.addEventListener('mouseout', (e) => {
    if (e.target && e.target.classList.contains('interactive-dot')) {
        hoveredPinIndex = -1;
        document.body.style.cursor = 'default';
    }
});

// If the pointer leaves the SVG layer entirely, ensure we reset hover/cursor.
svgLayer.addEventListener('mouseleave', () => {
    hoveredPinIndex = -1;
    document.body.style.cursor = 'default';
});

// --- Selection Logic ---
const selector = document.getElementById('bio-selector');

// Load Manifest
// Friendly warning if opened via file:// (fetch may fail)
if (window.location.protocol === 'file:') {
    setStatus(
        '<strong>Tip:</strong> This app loads files via <code>fetch()</code>. Open it through a local server (http://localhost/...) rather than <code>file://</code>.',
        { kind: 'error', persist: true }
    );
} else {
    setStatus('Loading biographies…', { kind: 'info', persist: true });
}

fetch('data/bios_manifest.json')
    .then(res => res.json())
    .then(manifest => {
        selector.innerHTML = '<option value="" disabled>Select Biography...</option>';
        manifest.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.file;
            opt.textContent = item.name;
            selector.appendChild(opt);
        });

        // Auto-load
        const urlParams = new URLSearchParams(window.location.search);
        const initialFile = urlParams.get('file') || manifest[0].file;

        selector.value = initialFile;
        loadBio(initialFile);
    })
    .catch(err => {
        console.error("Manifest load error:", err);
        selector.innerHTML = '<option disabled>Error Loading Manifest</option>';
        setStatus(
            '<strong>Failed to load</strong> <code>bios_manifest.json</code>. If you opened this via <code>file://</code>, run a local server (see README).',
            { kind: 'error', persist: true }
        );
    });

// Switch Logic
selector.addEventListener('change', (e) => {
    loadBio(e.target.value);
});

// --- Load Model ---
const loader = new GLTFLoader();

function loadBio(filename) {
    console.log("Loading Bio:", filename);
    setStatus(`Loading <code>${filename}</code>…`, { kind: 'info', persist: true });

    // Cleanup Old
    if (currentModel) {
        scene.remove(currentModel);
        disposeObject3D(currentModel);
        currentModel = null;
    }
    // Cleanup latLonGrid if it exists
    if (latLonGrid) {
        if (latLonGrid.parent) {
            latLonGrid.parent.remove(latLonGrid);
        }
        disposeObject3D(latLonGrid);
        latLonGrid = null;
    }
    labelsLayer.innerHTML = '';
    svgLayer.innerHTML = '';
    pins = [];
    mixer = null;
    hoveredPinIndex = -1; // Reset selection

    // Load New
    loader.load('data/' + filename, (gltf) => {
        const model = gltf.scene;
        currentModel = model;

        // Setup scene nodes BEFORE adding to scene to avoid traversal issues
        setupSceneNodes(model);

        // Now add to scene
        scene.add(model);

        // Animation setup
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
                mixer.clipAction(clip).play();
            });
        }

        // Hide status after successful load, unless we're in a file:// warning state.
        if (window.location.protocol !== 'file:') {
            setStatus('', { persist: false });
        }

    }, undefined, function (error) {
        console.error('An error occurred loading ' + filename, error);
        setStatus(
            `<strong>Failed to load</strong> <code>${filename}</code>. Check the file exists and that you're running via HTTP (not <code>file://</code>).`,
            { kind: 'error', persist: true }
        );
    });
}

// Helper function to check for circular references before adding child
function safeAddChild(parent, child) {
    // Check if child already has a parent
    if (child.parent) {
        child.parent.remove(child);
    }
    parent.add(child);
    return true;
}

function setupSceneNodes(model) {
    // Prevent multiple setups on the same model
    if (model.userData._sceneNodesSetup) return;
    model.userData._sceneNodesSetup = true;

    let gridAdded = false;
    const meshes = [];
    
    // First pass: collect all meshes without modifying hierarchy
    model.traverse((node) => {
        if (node.isMesh) {
            meshes.push(node);
        }
    });

    // Second pass: modify meshes (now safe from traversal issues)
    meshes.forEach((node) => {
        if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
        const radius = node.geometry.boundingSphere.radius;
        const vertexCount = node.geometry.attributes.position ? node.geometry.attributes.position.count : 0;

        // 1. Water Sphere
        if (radius >= 99 && radius < 100.8) {
            node.visible = false;
        }

        // 2. Land Mesh
        if ((radius >= 100.5 && vertexCount > 500) || vertexCount > 4000 || node.name === 'Land') {
            // Subtle contrast border (outline shell)
            // Render a slightly-expanded backface-only copy behind the land.
            // This makes coastlines/edges read better without heavy postprocessing.
            if (!node.userData._outlineAdded) {
                const outlineMat = new THREE.MeshBasicMaterial({
                    color: 0x0b1320, // deep navy outline (subtle against space + teal grid)
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0.55,
                    depthTest: true,
                    depthWrite: false
                });
                // Clone geometry to avoid sharing issues
                const outlineGeometry = node.geometry.clone();
                const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMat);
                outlineMesh.name = `${node.name || 'Land'}_Outline`;
                outlineMesh.scale.setScalar(1.012);
                outlineMesh.renderOrder = -0.5;
                safeAddChild(node, outlineMesh);
                node.userData._outlineAdded = true;
            }

            node.material = new THREE.MeshStandardMaterial({
                color: 0x1a5c40,      // Deep Jade
                emissive: 0x001a10,   // Subtle bioluminescent glow
                roughness: 0.3,       // Glassy/Polished
                metalness: 0.4,       // Semi-metallic
                side: THREE.DoubleSide,
                transparent: true,    // Enable transparency
                opacity: 0.92         // "Thick" glass look (slightly less see-through to avoid inner grid bleed-through)
            });
            node.visible = true;
            node.renderOrder = 0;

            // Attach Grid to the first Land node found
            // Ensure grid is only added once and not already attached
            if (!gridAdded && !latLonGrid) {
                latLonGrid = createLatLonGrid();
                if (safeAddChild(node, latLonGrid)) {
                    gridAdded = true;
                }
            }
        }

        // 3. Setup Pins
        if (radius < 10 && vertexCount < 1000) {
            if ((node.userData && node.userData.extras && node.userData.extras.type === 'event_pin') || (vertexCount > 50 && vertexCount < 500)) {
                setupPin(node);
            }
        }

        // 4. Path
        if (String(node.name).includes('Path')) {
            // Nebula amber
            node.material.emissive = new THREE.Color(0xffb703);
            node.material.emissiveIntensity = 1.0;
        }
    });
}

function setupPin(mesh) {
    const index = pins.length;

    // Color variation based on index (constellation rainbow)
    const hue = (index * 137.5) % 360; // Golden angle distribution for varied colors
    const color = new THREE.Color().setHSL(hue / 360, 0.8, 0.6);

    // Custom Shader Material for Star Effect
    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            baseColor: { value: color },
                    glowColor: { value: new THREE.Color(0x38d6c8) },
            intensity: { value: 1.0 },
            // Don't define a uniform named `cameraPosition`.
            // Three.js already injects a built-in `cameraPosition` uniform for
            // ShaderMaterial, and redefining it can cause shader compile/validate
            // errors on some WebGL implementations.
            uCameraPosition: { value: new THREE.Vector3() }
        },
        vertexShader: `
            precision mediump float;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision mediump float;
            uniform float time;
            uniform vec3 baseColor;
            uniform vec3 glowColor;
            uniform float intensity;
            uniform vec3 uCameraPosition;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            
            void main() {
                // Fresnel glow effect
                vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
                float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.0);
                
                // Sparkle effect (noise-based)
                float sparkle = sin(time * 5.0 + vWorldPosition.x * 10.0) * 0.5 + 0.5;
                sparkle = pow(sparkle, 8.0) * 0.3;
                
                // Pulse effect
                float pulse = sin(time * 2.0) * 0.15 + 0.85;
                
                // Combine effects
                vec3 finalColor = baseColor * (1.0 + sparkle);
                finalColor += glowColor * fresnel * 0.8;
                finalColor *= pulse * intensity;
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        transparent: false,
        side: THREE.DoubleSide
    });

    mesh.material = starMaterial;

    // Store animation properties
    mesh.userData.starMaterial = starMaterial;
    mesh.userData.rotationSpeed = 0.5 + Math.random() * 1.5;
    mesh.userData.pulseOffset = Math.random() * Math.PI * 2;
    // Stable per-pin phase so scale shimmer doesn't "jump" when models reload.
    mesh.userData.pulsePhase = Math.random() * Math.PI * 2;

    // Label
    const div = document.createElement('div');
    div.className = 'label';
    const data = mesh.userData.extras || { name: 'Event', year: '', description: '' };

    // Format: Clean Name
    let cleanName = (data.name || 'Event').replace(/_/g, ' ').toLowerCase();
    cleanName = cleanName.replace(/\b\w/g, c => c.toUpperCase()); // Title Case

    // Description (Fallback to dummy text if missing)
    const desc = data.description || "Historical event recorded in the archives.";

    div.innerHTML = `
                <h4><span class="year">${data.year || ''}</span> ${cleanName}</h4>
                <div class="desc">${desc}</div>
            `;
    labelsLayer.appendChild(div);

    // Hover Listeners on Label
    div.addEventListener('mouseenter', () => {
        hoveredPinIndex = index;
    });
    div.addEventListener('mouseleave', () => {
        hoveredPinIndex = -1;
    });

    pins.push({
        index: index,
        mesh: mesh,
        div: div,
        anchor: new THREE.Vector3(),
        pos: new THREE.Vector2(),
        year: parseInt(data.year) || 0
    });
}

// --- Label Layout System ---
// Cache for reuse
const _vCenter = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vEdge = new THREE.Vector3();
const _targetPos = new THREE.Vector2();

function updateLabels() {
    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;

    // --- DYNAMIC GLOBE TRACKING ---
    // Track the center of the globe (0,0,0) in screen space
    _vCenter.set(0, 0, 0);
    _vCenter.project(camera);
    const cx = _vCenter.x * halfW + halfW;
    const cy = -_vCenter.y * halfH + halfH;

    // Calculate Projected Radius (Distance from Center to Visual Edge)
    // We use the camera's "Right" vector to find a point on the horizon of the sphere
    // that represents its visual radius, regardless of rotation.
    _vRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _vEdge.set(0, 0, 0).addScaledVector(_vRight, 100.5);
    _vEdge.project(camera);

    const vEdgeScreenX = _vEdge.x * halfW + halfW;
    const vEdgeScreenY = -_vEdge.y * halfH + halfH;

    let earthRad = Math.hypot(vEdgeScreenX - cx, vEdgeScreenY - cy);
    if (isNaN(earthRad) || earthRad < 1) earthRad = 100; // Fallback

    // Timeline Geometry
    const timelineRad = earthRad * 1.15;
    const bandWidth = 20;
    const bandInner = timelineRad - bandWidth / 2;
    const bandOuter = timelineRad + bandWidth / 2;

    // --- Helper Functions (Scoped Here) ---
    function polarToCartesian(r, angle) {
        if (isNaN(cx) || isNaN(cy)) return { x: 0, y: 0 };
        return {
            x: cx + (r * Math.cos(angle)),
            y: cy + (r * Math.sin(angle))
        };
    }

    function drawSector(innerR, outerR, startA, endA, color, opacity) {
        const p1 = polarToCartesian(innerR, startA);
        const p2 = polarToCartesian(outerR, startA);
        const p3 = polarToCartesian(outerR, endA);
        const p4 = polarToCartesian(innerR, endA);

        // Check for NaN path
        if (isNaN(p1.x) || isNaN(p2.x)) return '';

        const largeArc = (endA - startA) > Math.PI ? 1 : 0;

        return `<path d="
                    M ${p1.x} ${p1.y}
                    L ${p2.x} ${p2.y}
                    A ${outerR} ${outerR} 0 ${largeArc} 1 ${p3.x} ${p3.y}
                    L ${p4.x} ${p4.y}
                    A ${innerR} ${innerR} 0 ${largeArc} 0 ${p1.x} ${p1.y}
                    Z" 
                    fill="${color}" fill-opacity="${opacity}" stroke="none" />`;
    }

    // 1. Gather & Sort Visible Pins
    const visiblePins = [];
    const dt = updateLabels._dt || 0.0167; // 1/60

    const elapsedTime = clock.getElapsedTime();
    const camPos = camera.position;
    
    for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        const worldPos = _scratchWorldPos;
        p.mesh.getWorldPosition(worldPos);

        const isHovered = (p.index === hoveredPinIndex);

        // Update shader uniforms
        const starMat = p.mesh.userData.starMaterial;
        if (starMat) {
            const uniforms = starMat.uniforms;
            uniforms.time.value = elapsedTime + p.mesh.userData.pulseOffset;
            uniforms.intensity.value = isHovered ? 1.5 : 1.0;
            uniforms.uCameraPosition.value.copy(camPos);
        }

        // Rotation animation
        p.mesh.rotation.y += p.mesh.userData.rotationSpeed * 0.01;
        p.mesh.rotation.z = Math.sin(elapsedTime + p.mesh.userData.pulseOffset) * 0.2;

        // Scale pulse (enhanced on hover)
        const pulseSpeed = isHovered ? 4 : 3;
        const pulseAmount = isHovered ? 0.15 : 0.1;
        const pulse = 1 + Math.sin(elapsedTime * pulseSpeed + p.mesh.userData.pulsePhase) * pulseAmount;
        p.mesh.scale.setScalar(pulse);

        worldPos.project(camera);
        const screenX = worldPos.x * halfW + halfW;
        const screenY = -worldPos.y * halfH + halfH;

        if (isNaN(screenX) || isNaN(screenY)) {
            p.div.style.display = 'none';
            continue;
        }
        p.anchor.set(screenX, screenY, 0);
        visiblePins.push(p);
    }
    visiblePins.sort((a, b) => a.year - b.year);

    // 2. TIMELINE & COLLISION LOGIC 
    // Pre-allocate string builder for better performance
    const svgPaths = [];
    svgPaths.length = 0; // Clear array efficiently

    if (pins.length > 0) {
        const allSorted = [...pins].sort((a, b) => a.year - b.year);
        const birthYear = allSorted[0].year;
        const lastPinYear = allSorted[allSorted.length - 1].year;
        const currentYear = new Date().getFullYear();

        // Timeline Scale: Full circle (360°) = 100 years
        // 12 o'clock (top, -90°) = birth (0 years)
        // NOW is calculated dynamically
        const startAngle = -Math.PI / 2; // 12 o'clock

        const getAngle = (year) => {
            const ageInYears = year - birthYear;
            // 100 years = 360° (full circle)
            const angleOffset = (ageInYears / 100) * (Math.PI * 2);
            return startAngle + angleOffset;
        };

        // Calculate NOW position dynamically
        const currentAge = currentYear - birthYear;
        const nowAngle = getAngle(currentYear);

        // --- Calculate Target Positions & Resolve Collision ---
        const labelHeight = 40;
        const leftSide = [];
        const rightSide = [];

        visiblePins.forEach(p => {
            const angle = getAngle(p.year);
            const labelOffset = 50;
            const rawPos = polarToCartesian(timelineRad + labelOffset, angle);
            const isLeft = Math.cos(angle) < 0;
            if (!p.targetPos) p.targetPos = new THREE.Vector2();
            p.targetPos.set(rawPos.x, rawPos.y);
            p.isLeft = isLeft;
            p.angle = angle;
            if (isLeft) leftSide.push(p); else rightSide.push(p);
        });

        const resolveSide = (list) => {
            if (list.length < 2) return;
            list.sort((a, b) => a.targetPos.y - b.targetPos.y);
            for (let i = 1; i < list.length; i++) {
                const prev = list[i - 1];
                const curr = list[i];
                const dist = curr.targetPos.y - prev.targetPos.y;
                if (dist < labelHeight) {
                    curr.targetPos.y += (labelHeight - dist);
                }
            }
        };
        resolveSide(leftSide);
        resolveSide(rightSide);

        // --- Rendering ---
        const hasHover = (hoveredPinIndex !== -1);

        let highlightYear = -1;
        let highlightAge = -1;
        if (hasHover) {
            const targetPin = pins.find(p => p.index === hoveredPinIndex);
            if (targetPin) {
                const targetYear = targetPin.year;
                highlightYear = Math.round(targetYear / 10) * 10;
                highlightAge = Math.round((targetYear - birthYear) / 10) * 10;
            }
        }

        // 1. STRIPED BAND (Decades)
        // Cache these calculations
        const firstDecade = Math.floor(birthYear * 0.1) * 10;
        const maxDisplayedYear = birthYear + 100;
        const lastDecade = Math.ceil(maxDisplayedYear * 0.1) * 10;

        for (let y = firstDecade; y < lastDecade; y += 10) {
            // Start of decade
            const yStart = Math.max(birthYear, y);
            const yEnd = Math.min(maxDisplayedYear, y + 10);

            if (yStart >= yEnd) continue;

            const a1 = getAngle(yStart);
            const a2 = getAngle(yEnd);

            // Stripe Logic
            const isEven = (y / 10) % 2 === 0;
            const opacity = isEven ? 0.15 : 0.05;
            const color = "#38D6C8"; // Nebula teal stripes

            svgPaths.push(drawSector(bandInner, bandOuter, a1, a2, color, opacity));
        }

        // Add Border Lines to Band (full circle for 100 years)
        const arcStart = getAngle(birthYear);
        const arcEnd = getAngle(birthYear + 100);
        const largeArc = 1; // Always full circle

        // Outer Border
        const pOutStart = polarToCartesian(bandOuter, arcStart);
        const pOutEnd = polarToCartesian(bandOuter, arcEnd);
        svgPaths.push(`<path d="M ${pOutStart.x} ${pOutStart.y} A ${bandOuter} ${bandOuter} 0 ${largeArc} 1 ${pOutEnd.x} ${pOutEnd.y}" stroke="#38D6C8" stroke-width="1" stroke-opacity="0.45" fill="none" />`);

        // Inner Border
        const pInStart = polarToCartesian(bandInner, arcStart);
        const pInEnd = polarToCartesian(bandInner, arcEnd);
        svgPaths.push(`<path d="M ${pInStart.x} ${pInStart.y} A ${bandInner} ${bandInner} 0 ${largeArc} 1 ${pInEnd.x} ${pInEnd.y}" stroke="#38D6C8" stroke-width="1" stroke-opacity="0.45" fill="none" />`);


        // 2. Decade Ticks (Year) overlay
        for (let y = firstDecade; y <= maxDisplayedYear; y += 10) {
            const a = getAngle(y);
            const isHighlight = (y === highlightYear);
            const tickLen = isHighlight ? 8 : 4;
            const brightness = isHighlight ? 1.0 : 0.6;
            const width = isHighlight ? 2 : 1;
            const color = isHighlight ? '#FFB703' : `rgba(234, 242, 255, ${brightness})`;

            // Ticks on OUTER rim
            const p1 = polarToCartesian(bandOuter, a);
            const p2 = polarToCartesian(bandOuter + tickLen, a);

            svgPaths.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${width}" />`);

            if (y % 50 === 0 || isHighlight) {
                const dist = bandOuter + 15 + (isHighlight ? 5 : 0);
                const pText = polarToCartesian(dist, a);
                const fontSize = isHighlight ? 12 : 9;
                const fontWeight = isHighlight ? 'bold' : 'normal';
                svgPaths.push(`<text x="${pText.x}" y="${pText.y}" fill="${color}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="middle" alignment-baseline="middle">${y}</text>`);
            }
        }

        // 3. Age Scale (Inner Ticks) overlay
        const maxAge = 100; // Always show up to 100 years
        for (let age = 10; age <= maxAge; age += 10) {
            const y = birthYear + age;
            const a = getAngle(y);
            const isHighlight = (age === highlightAge);

            const brightness = isHighlight ? 1.0 : 0.8;
            const color = isHighlight ? '#EAF2FF' : `rgba(255, 183, 3, ${brightness})`;
            const width = isHighlight ? 2.5 : 1.5;

            // Ticks on INNER rim
            const p1 = polarToCartesian(bandInner, a);
            const p2 = polarToCartesian(bandInner - 5, a);
            svgPaths.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${width}" />`);

            if (age % 20 === 0 || isHighlight) {
                const fontSize = isHighlight ? 12 : (age % 20 === 0 ? 9 : 0);
                if (fontSize > 0) {
                    const pText = polarToCartesian(bandInner - 15, a);
                    svgPaths.push(`<text x="${pText.x}" y="${pText.y}" fill="${color}" font-size="${fontSize}" font-weight="${isHighlight ? 'bold' : 'normal'}" text-anchor="middle" alignment-baseline="middle">${age}</text>`);
                }
            }
        }

        // NOW Marker
        if (currentAge <= 100) {
            // Only show NOW if within 100 year range
            const pNow = polarToCartesian(timelineRad, nowAngle);
            svgPaths.push(`<circle cx="${pNow.x}" cy="${pNow.y}" r="4" fill="#38D6C8" stroke="#EAF2FF" stroke-width="1.5" />`);
            svgPaths.push(`<text x="${pNow.x + 12}" y="${pNow.y}" fill="#38D6C8" font-size="11" font-weight="bold" alignment-baseline="middle">NOW</text>`);
        }

        // 4. Pins
        visiblePins.forEach((p) => {
            const timelinePos = polarToCartesian(timelineRad, p.angle); // Pin on center of band
            const isHovered = (p.index === hoveredPinIndex);
            const isDimmed = hasHover && !isHovered;

            const opacity = isDimmed ? 0.1 : 1.0;
            const strokeColor = isHovered ? '#FFB703' : 'rgba(56, 214, 200, 0.45)';
            const strokeWidth = isHovered ? 2.5 : 1;
            const dotColor = isHovered ? '#FFB703' : '#38D6C8';

            // --- VISIBILITY CHECK ---
            // Determine if the pin is on the front (visible) side of the globe
            const worldPos = _scratchWorldPos;
            p.mesh.getWorldPosition(worldPos);

            // Vector from camera to pin
            const camToPin = _scratchCamToPin.subVectors(worldPos, camera.position);
            // Normal at pin position (sphere centered at origin)
            const pinNormal = _scratchPinNormal.copy(worldPos).normalize();

            // If dot product is negative, pin is facing away from camera (on back side)
            const isFrontFacing = camToPin.dot(pinNormal) < 0;

            const dx = p.anchor.x - cx; // Relative to dynamic center
            const dy = p.anchor.y - cy;
            const globeAngle = Math.atan2(dy, dx);

            let pathD;
            if (isFrontFacing) {
                // Pin is visible - use direct routing close to surface
                const cp2Dist = earthRad + 20;
                const cp2 = polarToCartesian(cp2Dist, globeAngle);
                const cp1Dist = bandInner - 30;
                const cp1 = polarToCartesian(cp1Dist, p.angle);

                pathD = `M${timelinePos.x},${timelinePos.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p.anchor.x},${p.anchor.y}`;
            } else {
                // Pin is on back side - route around the visible edge
                // Use a higher arc that stays well above the globe's visible silhouette
                const cp1Dist = timelineRad + 40; // Go outward from timeline
                const cp1 = polarToCartesian(cp1Dist, p.angle);

                // CP2: midpoint angle, but much higher to ensure we clear the globe
                const midAngle = (p.angle + globeAngle) / 2;
                const cp2Dist = Math.max(timelineRad + 60, earthRad + 80); // Well above surface
                const cp2 = polarToCartesian(cp2Dist, midAngle);

                pathD = `M${timelinePos.x},${timelinePos.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p.anchor.x},${p.anchor.y}`;
            }

            // Differentiate timeline callouts (dashed) from surface paths (solid)
            svgPaths.push(`<path d="${pathD}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="3,2" fill="none" style="opacity: ${opacity};"/>`);

            // Dot in middle of band
            const dotRadius = isHovered ? 6 : 4;
            const dotFill = isHovered ? '#FFB703' : '#38D6C8';
            const dotOpacity = opacity > 0.5 ? 1 : 0.3;
            svgPaths.push(`<circle class="interactive-dot" data-index="${p.index}" cx="${timelinePos.x}" cy="${timelinePos.y}" r="${dotRadius}" fill="${dotFill}" stroke="#000" stroke-width="1" style="opacity: ${dotOpacity}"/>`);
            svgPaths.push(`<circle cx="${p.anchor.x}" cy="${p.anchor.y}" r="${isHovered ? 4 : 2}" fill="${dotColor}" style="opacity: ${opacity}"/>`);

            // Delta-time based smoothing so motion feels consistent across frame rates.
            // 0.12 @ 60fps ~= ~7.2 smoothing speed.
            const follow = 1 - Math.exp(-7.2 * dt);
            p.pos.x += (p.targetPos.x - p.pos.x) * follow;
            p.pos.y += (p.targetPos.y - p.pos.y) * follow;
            const xShift = p.isLeft ? '-100%' : '0%';
            p.div.style.transform = `translate(${p.pos.x}px, calc(${p.pos.y}px - 50%)) translateX(${xShift})`;
            p.div.style.textAlign = p.isLeft ? 'right' : 'left';
            p.div.style.marginLeft = p.isLeft ? '-10px' : '10px';

            if (isHovered) p.div.classList.add('active'); else p.div.classList.remove('active');
            if (isDimmed) p.div.classList.add('dimmed'); else p.div.classList.remove('dimmed');
            p.div.style.display = 'block';
        });

        // Ghost Dots
        pins.forEach(p => {
            const a = getAngle(p.year);
            const d = polarToCartesian(timelineRad, a);
            const isHovered = (p.index === hoveredPinIndex);
            if (!visiblePins.includes(p)) {
                svgPaths.push(`<circle class="interactive-dot" data-index="${p.index}" cx="${d.x}" cy="${d.y}" r="${isHovered ? 5 : 2}" fill="rgba(255, 255, 255, ${isHovered ? 1 : 0.15})" stroke="none" />`);
            }
        });
    }
    // Use single assignment for better performance
    if (svgPaths.length > 0) {
        svgLayer.innerHTML = svgPaths.join('');
    } else {
        svgLayer.innerHTML = '';
    }
}

// Cache animation values
let _elapsed = 0;
let _breathValue = 0;
const PI_TIMES_2 = Math.PI * 2;

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // When tab is hidden, skip rendering entirely
    if (document.hidden) return;

    const delta = clock.getDelta();
    // Share dt with label updates for smoother, frame-rate-independent easing.
    updateLabels._dt = delta;

    if (mixer) mixer.update(delta);

    // --- Smooth focus transitions ---
    _elapsed = clock.getElapsedTime();
    const isHovering = hoveredPinIndex !== -1;

    // Auto-rotate easing
    _breathValue = BREATH_AMPLITUDE * Math.sin(_elapsed * PI_TIMES_2 * BREATH_SPEED);
    const targetAutoRotate = isHovering ? AUTO_ROTATE_HOVER : (AUTO_ROTATE_BASE * (1 + _breathValue));
    const rotateEase = 1 - Math.exp(-6.0 * delta);
    _autoRotateCurrent += (targetAutoRotate - _autoRotateCurrent) * rotateEase;
    controls.autoRotateSpeed = _autoRotateCurrent;

    // Bloom easing
    if (USE_POSTPROCESSING) {
        const targetBloom = isHovering ? BLOOM_HOVER : BLOOM_BASE;
        const bloomEase = 1 - Math.exp(-5.0 * delta);
        _bloomCurrent += (targetBloom - _bloomCurrent) * bloomEase;
        bloomPass.strength = _bloomCurrent;
    }

    // Keep the lat/lon grid on the visible hemisphere only.
    if (latLonGrid) {
        updateLatLonGridVisibility(latLonGrid);
    }

    controls.update();

    // Safety check for updateLabels (throttled)
    _labelUpdateAccumulator += delta;
    if (_labelUpdateAccumulator >= LABEL_UPDATE_INTERVAL) {
        // Avoid drift under slow frames.
        _labelUpdateAccumulator %= LABEL_UPDATE_INTERVAL;
        try {
            updateLabels();
        } catch (e) {
            console.warn("Label update error:", e);
        }
    }

    if (USE_POSTPROCESSING) composer.render();
    else renderer.render(scene, camera);
}

// --- Resize Handler ---
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
}

// Start Loop
animate();
