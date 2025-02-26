// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'queryLLM') {
    queryLLM(request, sendResponse);
    return true; // Indicates async response
  } else if (request.action === 'testConnection') {
    testConnection(request.settings, sendResponse);
    return true; // Indicates async response
  }
});

// Query the LLM with collected pages
async function queryLLM(request, sendResponse) {
  try {
    const { settings, prompt, systemPrompt, collectedPages } = request;
    
    if (!settings || !prompt) {
      sendResponse({ success: false, error: 'Invalid request' });
      return;
    }
    
    if (collectedPages.length === 0) {
      sendResponse({ success: false, error: 'No collected pages to query' });
      return;
    }
    
    // Prepare content from collected pages
    let pagesContent = collectedPages.map(page => {
      return `### Page: ${page.title}\n### URL: ${page.url}\n\n${page.content.mainContent}\n\n`;
    }).join('---\n\n');
    
    // Build the complete prompt
    let fullPrompt = `I'm going to provide you with content from ${collectedPages.length} web pages I've collected. Please analyze this content and respond to my question.\n\n`;
    fullPrompt += pagesContent;
    fullPrompt += `\n\nBased on the web content above, ${prompt}`;
    
    // Make API request based on LLM type
    let apiResponse;
    
    switch(settings.type) {
      case 'ollama':
        apiResponse = await queryOllama(settings, fullPrompt, systemPrompt);
        break;
      case 'vllm':
        apiResponse = await queryVLLM(settings, fullPrompt, systemPrompt);
        break;
      case 'custom':
        apiResponse = await queryCustomAPI(settings, fullPrompt, systemPrompt);
        break;
      default:
        sendResponse({ success: false, error: 'Invalid LLM type' });
        return;
    }
    
    sendResponse({ success: true, result: apiResponse });
  } catch (error) {
    console.error('Error querying LLM:', error);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

// Query Ollama API
async function queryOllama(settings, prompt, systemPrompt) {
  const url = `http://${settings.host}:${settings.port}/api/generate`;
  
  const requestBody = {
    model: settings.modelName,
    prompt: prompt,
    stream: false
  };
  
  // Add system prompt if provided
  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': chrome.runtime.getURL(''),
        'Access-Control-Request-Method': 'POST'
      },
      mode: 'cors',
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama API error:", error);
    
    // If we got a CORS error, provide more helpful information
    if (error.message.includes("Failed to fetch") || error.message.includes("CORS")) {
      throw new Error(`CORS error connecting to Ollama. Make sure Ollama is running with CORS enabled. Try running Ollama with: OLLAMA_ORIGINS=* ollama serve`);
    }
    throw error;
  }
}

// Query VLLM API
async function queryVLLM(settings, prompt, systemPrompt) {
  const url = `http://${settings.host}:${settings.port}/v1/completions`;
  
  const requestBody = {
    prompt: prompt,
    max_tokens: 4096,
    temperature: 0.7,
    model: settings.modelName
  };
  
  // Add system prompt if provided (adjust based on VLLM API)
  if (systemPrompt) {
    requestBody.system_prompt = systemPrompt;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`VLLM API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  // Handle VLLM response format
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].text;
  } else {
    throw new Error('Unexpected VLLM response format');
  }
}

// Query custom API
async function queryCustomAPI(settings, prompt, systemPrompt) {
  const url = `http://${settings.host}:${settings.port}${settings.endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Add API key if provided
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }
  
  const requestBody = {
    prompt: prompt,
    model: settings.modelName
  };
  
  // Add system prompt if provided
  if (systemPrompt) {
    requestBody.system_prompt = systemPrompt;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  // Try to extract response from common API formats
  if (data.response) {
    return data.response;
  } else if (data.choices && data.choices.length > 0) {
    if (data.choices[0].text) {
      return data.choices[0].text;
    } else if (data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content;
    }
  } else if (data.output) {
    return data.output;
  } else if (data.content) {
    return data.content;
  }
  
  // If we can't parse the response, return the raw JSON
  return JSON.stringify(data, null, 2);
}

// Test connection to LLM
async function testConnection(settings, sendResponse) {
  try {
    switch(settings.type) {
      case 'ollama':
        await testOllamaConnection(settings);
        break;
      case 'vllm':
        await testVLLMConnection(settings);
        break;
      case 'custom':
        await testCustomAPIConnection(settings);
        break;
      default:
        sendResponse({ success: false, error: 'Invalid LLM type' });
        return;
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Connection test error:', error);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

// Test Ollama connection
async function testOllamaConnection(settings) {
  const url = `http://${settings.host}:${settings.port}/api/tags`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': chrome.runtime.getURL(''),
        'Access-Control-Request-Method': 'GET'
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    // If we get here, the connection is successful
    return true;
  } catch (error) {
    console.error("Ollama connection test error:", error);
    
    // If we got a CORS error, provide more helpful information
    if (error.message.includes("Failed to fetch") || error.message.includes("CORS")) {
      throw new Error(`CORS error connecting to Ollama. Make sure Ollama is running with CORS enabled. Try running Ollama with: OLLAMA_ORIGINS=* ollama serve`);
    }
    throw error;
  }
}

// Test VLLM connection
async function testVLLMConnection(settings) {
  const url = `http://${settings.host}:${settings.port}/v1/models`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`VLLM API error (${response.status}): ${errorText}`);
  }
  
  // If we get here, the connection is successful
  return true;
}

// Test custom API connection
async function testCustomAPIConnection(settings) {
  // For custom API, we'll try a minimal request
  const url = `http://${settings.host}:${settings.port}${settings.endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Add API key if provided
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }
  
  const requestBody = {
    prompt: 'Hello, this is a test.',
    model: settings.modelName,
    max_tokens: 5 // Minimum tokens to reduce processing time
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  
  // If we get here, the connection is successful
  return true;
}