document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show selected tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Initialize current page info
  updateCurrentPageInfo();
  
  // Load collected pages
  loadCollectedPages();
  
  // Load settings
  loadSettings();
  
  // Event listeners
  document.getElementById('collect-btn').addEventListener('click', collectCurrentPage);
  document.getElementById('clear-pages').addEventListener('click', clearAllPages);
  document.getElementById('send-query').addEventListener('click', sendQueryToLLM);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('test-connection').addEventListener('click', testConnection);
  document.getElementById('use-system-prompt').addEventListener('change', toggleSystemPrompt);
  document.getElementById('llm-type').addEventListener('change', toggleCustomAPISettings);
  
  // Initialize UI state
  toggleSystemPrompt();
  toggleCustomAPISettings();
});

// Update current page information
function updateCurrentPageInfo() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      document.getElementById('current-url').textContent = currentTab.url;
      document.getElementById('current-title').textContent = currentTab.title;
    }
  });
}

// Collect current page
function collectCurrentPage() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      
      // Execute script to get page content
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: getPageContent
      }, (results) => {
        if (results && results[0]) {
          const pageData = {
            url: currentTab.url,
            title: currentTab.title,
            content: results[0].result,
            timestamp: new Date().toISOString()
          };
          
          // Save to storage
          chrome.storage.local.get({collectedPages: []}, function(data) {
            const pages = data.collectedPages;
            
            // Check if page already exists
            const existingPageIndex = pages.findIndex(page => page.url === pageData.url);
            
            if (existingPageIndex >= 0) {
              // Update existing page
              pages[existingPageIndex] = pageData;
              document.getElementById('collect-status').textContent = 'Page updated!';
              document.getElementById('collect-status').className = 'status success';
            } else {
              // Add new page
              pages.push(pageData);
              document.getElementById('collect-status').textContent = 'Page collected!';
              document.getElementById('collect-status').className = 'status success';
            }
            
            chrome.storage.local.set({collectedPages: pages}, function() {
              loadCollectedPages();
              
              // Clear status after 3 seconds
              setTimeout(() => {
                document.getElementById('collect-status').textContent = '';
                document.getElementById('collect-status').className = 'status';
              }, 3000);
            });
          });
        } else {
          document.getElementById('collect-status').textContent = 'Failed to collect page content.';
          document.getElementById('collect-status').className = 'status error';
        }
      });
    }
  });
}

// Get page content function (executed in the context of the web page)
function getPageContent() {
  // Get the main content
  const bodyText = document.body.innerText;
  
  // Try to get the most relevant content
  let mainContent = '';
  
  // Try to find main content by common tags
  const mainElements = document.querySelectorAll('main, article, [role="main"]');
  if (mainElements.length > 0) {
    // Use the first main element found
    mainContent = mainElements[0].innerText;
  } else {
    // Fallback to body text but try to remove navigation, footers, etc.
    const elementsToIgnore = document.querySelectorAll('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]');
    elementsToIgnore.forEach(el => {
      if (el.innerText) {
        el.dataset.originalText = el.innerText;
        el.innerText = '';
      }
    });
    
    // Get cleaned content
    mainContent = document.body.innerText;
    
    // Restore original text
    elementsToIgnore.forEach(el => {
      if (el.dataset.originalText) {
        el.innerText = el.dataset.originalText;
        delete el.dataset.originalText;
      }
    });
  }
  
  // Return both full and main content
  return {
    fullText: bodyText,
    mainContent: mainContent,
    title: document.title,
    url: window.location.href
  };
}

// Load collected pages
function loadCollectedPages() {
  chrome.storage.local.get({collectedPages: []}, function(data) {
    const pagesList = document.getElementById('pages-list');
    pagesList.innerHTML = '';
    
    if (data.collectedPages.length === 0) {
      pagesList.innerHTML = '<p>No pages collected yet.</p>';
      return;
    }
    
    data.collectedPages.forEach((page, index) => {
      const pageElement = document.createElement('div');
      pageElement.className = 'page-item';
      
      const pageTitle = document.createElement('div');
      pageTitle.className = 'page-title';
      pageTitle.textContent = page.title;
      
      const pageUrl = document.createElement('div');
      pageUrl.className = 'page-url';
      pageUrl.textContent = page.url;
      
      const removeButton = document.createElement('span');
      removeButton.className = 'remove-page';
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => removeCollectedPage(index));
      
      pageElement.appendChild(pageTitle);
      pageElement.appendChild(pageUrl);
      pageElement.appendChild(removeButton);
      pagesList.appendChild(pageElement);
    });
  });
}

// Remove a collected page
function removeCollectedPage(index) {
  chrome.storage.local.get({collectedPages: []}, function(data) {
    const pages = data.collectedPages;
    pages.splice(index, 1);
    
    chrome.storage.local.set({collectedPages: pages}, function() {
      loadCollectedPages();
    });
  });
}

// Clear all collected pages
function clearAllPages() {
  if (confirm('Are you sure you want to clear all collected pages?')) {
    chrome.storage.local.set({collectedPages: []}, function() {
      loadCollectedPages();
    });
  }
}

// Toggle system prompt visibility
function toggleSystemPrompt() {
  const useSystemPrompt = document.getElementById('use-system-prompt').checked;
  const systemPromptContainer = document.getElementById('system-prompt-container');
  
  if (useSystemPrompt) {
    systemPromptContainer.classList.remove('hidden');
  } else {
    systemPromptContainer.classList.add('hidden');
  }
}

// Toggle custom API settings
function toggleCustomAPISettings() {
  const llmType = document.getElementById('llm-type').value;
  const customApiSettings = document.getElementById('custom-api-settings');
  
  if (llmType === 'custom') {
    customApiSettings.classList.remove('hidden');
  } else {
    customApiSettings.classList.add('hidden');
  }
}

// Load settings
function loadSettings() {
  chrome.storage.local.get({
    llmSettings: {
      type: 'ollama',
      host: 'localhost',
      port: '11434',
      endpoint: '/api/generate',
      apiKey: '',
      modelName: 'mistral:latest'
    }
  }, function(data) {
    const settings = data.llmSettings;
    
    document.getElementById('llm-type').value = settings.type;
    document.getElementById('api-host').value = settings.host;
    document.getElementById('api-port').value = settings.port;
    document.getElementById('api-endpoint').value = settings.endpoint;
    document.getElementById('api-key').value = settings.apiKey;
    document.getElementById('model-name').value = settings.modelName;
    
    // Update UI based on settings
    toggleCustomAPISettings();
  });
}

// Save settings
function saveSettings() {
  const settings = {
    type: document.getElementById('llm-type').value,
    host: document.getElementById('api-host').value,
    port: document.getElementById('api-port').value,
    endpoint: document.getElementById('api-endpoint').value,
    apiKey: document.getElementById('api-key').value,
    modelName: document.getElementById('model-name').value
  };
  
  chrome.storage.local.set({llmSettings: settings}, function() {
    const status = document.getElementById('connection-status');
    status.textContent = 'Settings saved!';
    status.className = 'status success';
    
    // Clear status after 3 seconds
    setTimeout(() => {
      status.textContent = '';
      status.className = 'status';
    }, 3000);
  });
}

// Test connection to LLM
function testConnection() {
  const status = document.getElementById('connection-status');
  status.textContent = 'Testing connection...';
  status.className = 'status';
  
  // Get current settings
  const settings = {
    type: document.getElementById('llm-type').value,
    host: document.getElementById('api-host').value,
    port: document.getElementById('api-port').value,
    endpoint: document.getElementById('api-endpoint').value,
    apiKey: document.getElementById('api-key').value,
    modelName: document.getElementById('model-name').value
  };
  
  // Send a simple test query
  chrome.runtime.sendMessage({
    action: 'testConnection',
    settings: settings
  }, function(response) {
    if (response.success) {
      status.textContent = 'Connection successful!';
      status.className = 'status success';
    } else {
      status.textContent = 'Connection failed: ' + response.error;
      status.className = 'status error';
    }
  });
}

// Send query to LLM
function sendQueryToLLM() {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }
  
  // Get system prompt if enabled
  let systemPrompt = null;
  if (document.getElementById('use-system-prompt').checked) {
    systemPrompt = document.getElementById('system-prompt').value.trim();
  }
  
  // Show loading indicator
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('response-container').textContent = '';
  
  // Get current settings
  chrome.storage.local.get({
    llmSettings: {
      type: 'ollama',
      host: 'localhost',
      port: '11434',
      endpoint: '/api/generate',
      apiKey: '',
      modelName: 'mistral:latest'
    },
    collectedPages: []
  }, function(data) {
    // Prepare data for the query
    const queryData = {
      action: 'queryLLM',
      settings: data.llmSettings,
      prompt: prompt,
      systemPrompt: systemPrompt,
      collectedPages: data.collectedPages
    };
    
    // Send message to background script
    chrome.runtime.sendMessage(queryData, function(response) {
      // Hide loading indicator
      document.getElementById('loading').classList.add('hidden');
      
      if (response.success) {
        document.getElementById('response-container').textContent = response.result;
      } else {
        document.getElementById('response-container').textContent = 'Error: ' + response.error;
      }
    });
  });
}
