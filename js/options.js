// Default options
const DEFAULT_OPTIONS = {
  llmSettings: {
    type: 'ollama',
    host: 'localhost',
    port: '11434',
    endpoint: '/api/generate',
    apiKey: '',
    modelName: 'mistral:latest'
  },
  contentSettings: {
    maxStoredPages: 50,
    defaultSystemPrompt: 'You are a helpful assistant that analyzes web page content. Provide accurate, concise answers based on the information in the provided pages.',
    contentExtractionStrategy: 'smart',
    maxContentLength: 50000
  }
};

// When document is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Load options
  loadOptions();
  
  // Set up event listeners
  document.getElementById('default-llm-type').addEventListener('change', toggleCustomAPIOptions);
  document.getElementById('save-options').addEventListener('click', saveOptions);
  document.getElementById('reset-options').addEventListener('click', resetOptions);
  document.getElementById('clear-all-data').addEventListener('click', clearAllData);
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
});

// Load options from storage
function loadOptions() {
  chrome.storage.local.get({
    options: DEFAULT_OPTIONS
  }, function(data) {
    const options = data.options;
    
    // LLM Settings
    document.getElementById('default-llm-type').value = options.llmSettings.type;
    document.getElementById('default-host').value = options.llmSettings.host;
    document.getElementById('default-port').value = options.llmSettings.port;
    document.getElementById('default-endpoint').value = options.llmSettings.endpoint;
    document.getElementById('default-api-key').value = options.llmSettings.apiKey;
    document.getElementById('default-model').value = options.llmSettings.modelName;
    
    // Content Settings
    document.getElementById('max-stored-pages').value = options.contentSettings.maxStoredPages;
    document.getElementById('default-system-prompt').value = options.contentSettings.defaultSystemPrompt;
    document.getElementById('content-extraction-strategy').value = options.contentSettings.contentExtractionStrategy;
    document.getElementById('max-content-length').value = options.contentSettings.maxContentLength;
    
    // Update UI
    toggleCustomAPIOptions();
  });
}

// Save options to storage
function saveOptions() {
  const options = {
    llmSettings: {
      type: document.getElementById('default-llm-type').value,
      host: document.getElementById('default-host').value,
      port: document.getElementById('default-port').value,
      endpoint: document.getElementById('default-endpoint').value,
      apiKey: document.getElementById('default-api-key').value,
      modelName: document.getElementById('default-model').value
    },
    contentSettings: {
      maxStoredPages: parseInt(document.getElementById('max-stored-pages').value) || DEFAULT_OPTIONS.contentSettings.maxStoredPages,
      defaultSystemPrompt: document.getElementById('default-system-prompt').value,
      contentExtractionStrategy: document.getElementById('content-extraction-strategy').value,
      maxContentLength: parseInt(document.getElementById('max-content-length').value) || DEFAULT_OPTIONS.contentSettings.maxContentLength
    }
  };
  
  chrome.storage.local.set({options: options}, function() {
    // Also update the active llmSettings
    chrome.storage.local.set({llmSettings: options.llmSettings}, function() {
      showStatus('status', 'Options saved successfully!', 'success');
    });
  });
}

// Reset options to defaults
function resetOptions() {
  if (confirm('Are you sure you want to reset all options to default values?')) {
    chrome.storage.local.set({options: DEFAULT_OPTIONS}, function() {
      // Also update the active llmSettings
      chrome.storage.local.set({llmSettings: DEFAULT_OPTIONS.llmSettings}, function() {
        loadOptions();
        showStatus('status', 'Options reset to defaults.', 'success');
      });
    });
  }
}

// Toggle custom API options visibility
function toggleCustomAPIOptions() {
  const llmType = document.getElementById('default-llm-type').value;
  const customApiOptions = document.getElementById('custom-api-options');
  
  if (llmType === 'custom') {
    customApiOptions.classList.remove('hidden');
  } else {
    customApiOptions.classList.add('hidden');
  }
}

// Clear all extension data
function clearAllData() {
  if (confirm('Are you sure you want to clear ALL data including collected pages and settings? This cannot be undone.')) {
    chrome.storage.local.clear(function() {
      // Reload options with defaults
      loadOptions();
      showStatus('data-status', 'All data has been cleared.', 'success');
    });
  }
}

// Export data
function exportData() {
  chrome.storage.local.get(null, function(data) {
    // Convert data to JSON string
    const jsonData = JSON.stringify(data, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonData], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    // Create temporary link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = 'local-llm-collector-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 100);
    
    showStatus('data-status', 'Data exported successfully!', 'success');
  });
}

// Import data
function importData(event) {
  const file = event.target.files[0];
  
  if (!file) {
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      if (confirm('Are you sure you want to import this data? It will replace all current extension data.')) {
        chrome.storage.local.clear(function() {
          chrome.storage.local.set(data, function() {
            loadOptions();
            showStatus('data-status', 'Data imported successfully!', 'success');
          });
        });
      }
    } catch (error) {
      showStatus('data-status', 'Error importing data: ' + error.message, 'error');
    }
  };
  
  reader.readAsText(file);
  
  // Reset the file input
  event.target.value = '';
}

// Show status message
function showStatus(elementId, message, type) {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = 'status ' + type;
  status.classList.remove('hidden');
  
  setTimeout(function() {
    status.classList.add('hidden');
  }, 3000);
}
