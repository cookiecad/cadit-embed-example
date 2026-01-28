# CADit Embed Example

This repository demonstrates how to embed CADit in your website and communicate with it using the postMessage API.

## Live Demo

Visit [https://cookiecad.github.io/cadit-embed-example](https://cookiecad.github.io/cadit-embed-example) to see the example in action.

## Quick Start

### 1. Add the iframe

```html
<iframe
  id="caditFrame"
  src="https://app.cadit.com/?embed=true&partnerName=YourAppName"
  allow="clipboard-read; clipboard-write"
  style="width: 100%; height: 600px; border: none;"
></iframe>
```

### 2. Set up message handling

```javascript
const CADIT_ORIGIN = 'https://app.cadit.com';

// Listen for messages from CADit
window.addEventListener('message', (event) => {
  if (event.origin !== CADIT_ORIGIN) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'ready':
      console.log('CADit is ready!', payload.version);
      break;
    case 'export-stl':
      // Handle the exported STL blob
      downloadBlob(payload.blob, payload.filename);
      break;
  }
});
```

### 3. Send messages to CADit

```javascript
// Initialize with your app name
caditFrame.contentWindow.postMessage({
  type: 'init',
  payload: { partnerName: 'YourAppName' }
}, CADIT_ORIGIN);

// Request STL export
caditFrame.contentWindow.postMessage({
  type: 'get-stl'
}, CADIT_ORIGIN);
```

## Message Protocol

### Inbound Messages (Parent -> CADit)

| Type | Payload | Description |
|------|---------|-------------|
| `init` | `{ partnerName: string, features?: string[] }` | Initialize CADit with your app name |
| `import-stl` | `{ blob: Blob \| ArrayBuffer, filename?: string }` | Import an STL file into CADit |
| `get-stl` | - | Request the current design as an STL |

### Outbound Messages (CADit -> Parent)

| Type | Payload | Description |
|------|---------|-------------|
| `ready` | `{ version: string }` | Sent when CADit is fully loaded |
| `export-stl` | `{ blob: Blob, filename: string }` | Sent when user clicks "Send to [Partner]" or in response to `get-stl` |

## URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `embed` | Enable embed mode | `embed=true` |
| `partnerName` | Set the partner name for the "Send to" button | `partnerName=MyApp` |

## Security

CADit uses origin verification to ensure secure communication:

1. Your domain must be added to CADit's allowed origins list
2. All postMessage communications verify the sender's origin
3. Wildcard origins (`*`) are never used for outbound messages

To get your domain added to the allowed origins, please contact the CADit team.

## Local Development

1. Clone this repository:
   ```bash
   git clone https://github.com/cookiecad/cadit-embed-example.git
   cd cadit-embed-example
   ```

2. Serve the files locally:
   ```bash
   # Using Python
   python -m http.server 8080

   # Using Node.js (npx)
   npx serve
   ```

3. Open http://localhost:8080 in your browser

Note: For local development, make sure `http://localhost:8080` (or your chosen port) is added to CADit's allowed origins.

## License

MIT
