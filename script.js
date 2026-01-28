/**
 * CADit Embed Example
 *
 * This script demonstrates how to communicate with an embedded CADit instance
 * using the postMessage API.
 */

// Configuration
// IMPORTANT: This must match the origin of your CADit iframe
// For local development, use 'http://localhost:5175'
// For production, use 'https://app.cadit.app'
const CADIT_ORIGIN = 'https://app.cadit.app';
const PARTNER_NAME = 'MyApp';

// DOM Elements
const caditFrame = document.getElementById('caditFrame');
const getStlBtn = document.getElementById('getStlBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const eventLog = document.getElementById('eventLog');
const previewContainer = document.getElementById('previewContainer');
const stlViewerContainer = document.getElementById('stlViewer');

// State
let isReady = false;
let currentBlob = null;
let currentFilename = null;

// Three.js viewer state
let scene, camera, renderer, controls, mesh;

/**
 * Initialize the Three.js STL viewer
 */
function initViewer() {
  const width = stlViewerContainer.clientWidth || 300;
  const height = 400;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f8f8);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(100, 100, 100);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  stlViewerContainer.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    const newWidth = stlViewerContainer.clientWidth || 300;
    camera.aspect = newWidth / height;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, height);
  });
}

/**
 * Load STL from blob into viewer
 */
function loadSTL(blob) {
  const loader = new THREE.STLLoader();

  blob.arrayBuffer().then(buffer => {
    const geometry = loader.parse(buffer);

    // Remove old mesh if exists
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    // Create material with pastel color
    const material = new THREE.MeshPhongMaterial({
      color: 0xa8c5da,
      specular: 0x111111,
      shininess: 30,
      flatShading: false
    });

    mesh = new THREE.Mesh(geometry, material);

    // Center the model
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    mesh.position.sub(center);

    scene.add(mesh);

    // Fit camera to model
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

    camera.position.set(cameraDistance, cameraDistance, cameraDistance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}

/**
 * Log an event to the event log panel
 */
function logEvent(type, direction, data) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  // For blobs, show metadata instead of the full object
  let displayData = data;
  if (data && data.blob instanceof Blob) {
    displayData = { ...data, blob: `Blob(${data.blob.size} bytes, ${data.blob.type})` };
  }

  const dataStr = displayData ? JSON.stringify(displayData, null, 2) : '';

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-type ${direction}">${direction === 'received' ? 'RECV' : 'SENT'}</span>
    <span class="log-message">${type}</span>
    ${dataStr ? `<pre>${dataStr}</pre>` : ''}
  `;

  eventLog.insertBefore(entry, eventLog.firstChild);
}

/**
 * Send a message to the CADit iframe
 */
function sendMessage(type, payload) {
  if (!caditFrame.contentWindow) {
    console.error('CADit iframe not available');
    return;
  }

  const message = { type, payload };
  caditFrame.contentWindow.postMessage(message, CADIT_ORIGIN);
  logEvent(type, 'sent', payload);
}

/**
 * Handle messages received from CADit
 */
function handleMessage(event) {
  // Security: Verify the message origin
  if (event.origin !== CADIT_ORIGIN) {
    // Log ignored messages for debugging (but don't show in event log for security)
    if (event.data && event.data.type) {
      console.log(`Ignored message from origin: ${event.origin} (expected: ${CADIT_ORIGIN})`);
    }
    return;
  }

  const { type, payload } = event.data;

  if (!type) {
    return;
  }

  console.log(`Received message: ${type}`, payload);
  logEvent(type, 'received', payload);

  switch (type) {
    case 'ready':
      handleReady(payload);
      break;
    case 'export-stl':
      handleExportStl(payload);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}

/**
 * Handle the 'ready' message from CADit
 */
function handleReady(payload) {
  isReady = true;
  statusText.textContent = `CADit ready (v${payload?.version || 'unknown'})`;
  getStlBtn.disabled = false;

  // Auto-initialize when CADit is ready
  sendInit();
}

/**
 * Handle the 'export-stl' message from CADit
 */
function handleExportStl(payload) {
  if (!payload?.blob) {
    console.error('No blob in export-stl payload');
    statusText.textContent = 'Error: No STL data received';
    return;
  }

  // Store for download
  currentBlob = payload.blob;
  currentFilename = payload.filename || 'design.stl';

  // Enable download button
  downloadBtn.disabled = false;

  // Show preview container and initialize viewer if needed
  previewContainer.style.display = 'block';
  if (!renderer) {
    initViewer();
  }

  // Load STL into viewer
  loadSTL(payload.blob);

  statusText.textContent = `Received: ${currentFilename} (${Math.round(payload.blob.size / 1024)} KB)`;
}

/**
 * Download the current STL file
 */
function downloadStl() {
  if (!currentBlob) {
    alert('No STL file available. Request an export first.');
    return;
  }

  const url = URL.createObjectURL(currentBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  statusText.textContent = `Downloaded: ${currentFilename}`;
}

/**
 * Send the init message to CADit
 */
function sendInit() {
  sendMessage('init', {
    partnerName: PARTNER_NAME,
    features: ['export']
  });
  statusText.textContent = 'Initialized with partner name: ' + PARTNER_NAME;
}

/**
 * Request STL export from CADit
 */
function requestStl() {
  if (!isReady) {
    alert('CADit is not ready yet. Please wait for it to load.');
    return;
  }

  sendMessage('get-stl', null);
  statusText.textContent = 'Requesting STL export...';
}

// Event Listeners
window.addEventListener('message', handleMessage);
getStlBtn.addEventListener('click', requestStl);
downloadBtn.addEventListener('click', downloadStl);

// Log initial state
logEvent('page-loaded', 'sent', {
  info: 'Waiting for CADit to send ready message...'
});
