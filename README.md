# Local LLM & Gemini Web Collector Chrome Extension

A Chrome Extension that integrates with locally hosted LLM services (Ollama, vLLM) or cloud services (Google Gemini, or custom APIs) to collect web pages and query the model.

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" at the top right
4. Click "Load unpacked" and select the extension directory

### Running Ollama with CORS Support

To avoid 403 errors when connecting to Ollama, you need to run Ollama with CORS enabled:

```bash
# Start Ollama with CORS enabled
OLLAMA_ORIGINS=* ollama serve
```

On Windows (PowerShell):
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

This allows the Chrome extension to communicate with the Ollama API.

## Usage

1. **Configure the extension**:
   - Click on the extension icon in your browser toolbar
   - Go to the "Settings" tab
   - Enter your Ollama or vLLM configuration
   - Click "Save Settings" and "Test Connection"

2. **Collect web pages**:
   - Browse to a web page you want to collect
   - Click the extension icon
   - Click "Collect This Page"

3. **Query the LLM**:
   - Click the extension icon
   - Go to the "Query LLM" tab
   - Write your prompt
   - Click "Send to LLM"

## Advanced Configuration

Right-click on the extension icon and select "Options" to access advanced settings:
- Default LLM settings
- Content extraction preferences
- Maximum stored pages
- Data import/export

## Troubleshooting

**403 Forbidden Error with Ollama**:
- Make sure Ollama is running with CORS enabled (see above)
- Check that the host and port in settings are correct
- Verify that the model specified exists in your Ollama installation

**Connection Errors**:
- Ensure the LLM service is running
- Check your firewall settings
- Verify the correct port is open

## License

MIT
