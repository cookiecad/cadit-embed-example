/**
 * CADit Embed Example
 *
 * This script demonstrates how to communicate with an embedded CADit instance
 * using the postMessage API.
 */

// Configuration
const CADIT_ORIGIN = 'https://app.cadit.com';
const PARTNER_NAME = 'MyApp';

// DOM Elements
const caditFrame = document.getElementById('caditFrame');
const initBtn = document.getElementById('initBtn');
const getStlBtn = document.getElementById('getStlBtn');
const statusText = document.getElementById('statusText');
const eventLog = document.getElementById('eventLog');

// State
let isReady = false;

/**
 * Log an event to the event log panel
 */
function logEvent(type, direction, data) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const dataStr = data ? JSON.stringify(data, null, 2) : '';

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
    // Ignore messages from other origins
    return;
  }

  const { type, payload } = event.data;

  if (!type) {
    console.warn('Received message without type:', event.data);
    return;
  }

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
    return;
  }

  // Create a download link for the STL file
  const blob = payload.blob;
  const filename = payload.filename || 'design.stl';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  statusText.textContent = `Downloaded: ${filename}`;
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
initBtn.addEventListener('click', sendInit);
getStlBtn.addEventListener('click', requestStl);

// Log initial state
logEvent('page-loaded', 'sent', {
  info: 'Waiting for CADit to send ready message...'
});
