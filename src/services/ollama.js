// Ollama API service with proper abort handling
// Supports both text-only and vision models (Qwen3-VL, LLaVA, etc.)

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

/**
 * Get Ollama configuration with validation
 * @returns {object} Configuration object with baseUrl and timeout
 */
export const getOllamaConfig = () => {
  const baseUrl = OLLAMA_BASE_URL;

  // Validate URL format
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol - must be http or https');
    }
  } catch (error) {
    console.error('Invalid OLLAMA_BASE_URL:', baseUrl, error.message);
    // Fall back to default
    return {
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      maxRetries: 3
    };
  }

  return {
    baseUrl,
    timeout: 30000,
    maxRetries: 3
  };
};

// Connection status
export const ConnectionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CHECKING: 'checking',
  ERROR: 'error',
};

// Error types for better handling
export class OllamaConnectionError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'OllamaConnectionError';
    this.cause = cause;
  }
}

export class OllamaModelError extends Error {
  constructor(message, model = null) {
    super(message);
    this.name = 'OllamaModelError';
    this.model = model;
  }
}

// Vision-capable models
export const VISION_MODELS = [
  'qwen3-vl:235b-cloud',
  'qwen3-vl:32b',
  'qwen3-vl:8b',
  'qwen3-vl:4b',
  'qwen3-vl:2b',
  'llava:latest',
  'llava:13b',
  'llava:7b',
  'bakllava:latest',
  'moondream:latest',
];

// Check if a model supports vision
export const isVisionModel = (model) => {
  const lowerModel = model.toLowerCase();
  return VISION_MODELS.some(vm => lowerModel.includes(vm.split(':')[0])) ||
         lowerModel.includes('vision') ||
         lowerModel.includes('-vl');
};

class OllamaService {
  constructor(baseUrl = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
    this.activeControllers = new Set();
    this.connectionStatus = ConnectionStatus.CHECKING;
    this.lastError = null;
  }

  // Create and track an AbortController
  createController() {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    return controller;
  }

  // Remove controller from tracking
  removeController(controller) {
    this.activeControllers.delete(controller);
  }

  // Abort all active requests (call on unmount)
  abortAll() {
    this.activeControllers.forEach(controller => {
      controller.abort();
    });
    this.activeControllers.clear();
  }

  // Health check - verify Ollama is running
  async healthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.connectionStatus = ConnectionStatus.CONNECTED;
        this.lastError = null;
        return { connected: true, models: (await response.json()).models || [] };
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.lastError = error.message;

      if (error.name === 'AbortError') {
        return { connected: false, error: 'Connection timeout - Ollama not responding' };
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return { connected: false, error: 'Cannot connect to Ollama. Is it running on ' + this.baseUrl + '?' };
      }
      return { connected: false, error: error.message };
    }
  }

  // Wrap fetch with timeout and better error handling
  async fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = options.signal ? null : this.createController();
    const activeSignal = options.signal || controller?.signal;

    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, { ...options, signal: activeSignal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);

        if (response.status === 404) {
          throw new OllamaModelError(`Model not found. Try: ollama pull <model-name>`, options.body?.model);
        }
        if (response.status === 500) {
          throw new OllamaConnectionError(`Ollama server error: ${errorText}`);
        }
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new OllamaConnectionError('Request timeout - Ollama is not responding');
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        throw new OllamaConnectionError('Cannot connect to Ollama. Is it running?');
      }
      throw error;
    } finally {
      if (controller) {
        this.removeController(controller);
      }
    }
  }

  async chat(messages, model = 'llama3.2', signal = null) {
    const controller = signal ? null : this.createController();
    const activeSignal = signal || controller?.signal;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
        }),
        signal: activeSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.message.content;
    } finally {
      if (controller) {
        this.removeController(controller);
      }
    }
  }

  // Streaming chat with proper cleanup
  async chatStream(messages, model, onChunk, onDone, signal = null) {
    const controller = signal ? null : this.createController();
    const activeSignal = signal || controller?.signal;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal: activeSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Use array + join for better performance with large responses
      const responseChunks = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check if aborted
        if (activeSignal?.aborted) {
          reader.cancel();
          break;
        }

        // Decode and append to buffer to handle partial lines
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              responseChunks.push(data.message.content);
              // Build full response only when needed for callback
              const fullResponse = responseChunks.join('');
              onChunk(data.message.content, fullResponse);
            }
            if (data.done) {
              const fullResponse = responseChunks.join('');
              onDone(fullResponse);
              return fullResponse;
            }
          } catch (e) {
            // Expected: partial JSON chunks during streaming
            if (e instanceof SyntaxError) continue;
            console.warn('Stream parse warning:', e.message);
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.message?.content) {
            responseChunks.push(data.message.content);
          }
        } catch (e) {
          // Ignore final parse errors
        }
      }

      const fullResponse = responseChunks.join('');
      onDone(fullResponse);
      return fullResponse;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Stream aborted');
        return null;
      }
      throw e;
    } finally {
      if (controller) {
        this.removeController(controller);
      }
    }
  }

  /**
   * Chat with vision model (non-streaming)
   * Messages can include images array with base64 data
   */
  async chatWithVision(messages, model = 'qwen3-vl:8b', signal = null) {
    const controller = signal ? null : this.createController();
    const activeSignal = signal || controller?.signal;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
        }),
        signal: activeSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.message.content;
    } finally {
      if (controller) {
        this.removeController(controller);
      }
    }
  }

  /**
   * Streaming chat with vision support
   * Messages can include images array with base64 data
   */
  async chatStreamWithVision(messages, model, onChunk, onDone, signal = null) {
    const controller = signal ? null : this.createController();
    const activeSignal = signal || controller?.signal;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal: activeSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Use array + join for better performance with large responses
      const responseChunks = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (activeSignal?.aborted) {
          reader.cancel();
          break;
        }

        // Decode and append to buffer to handle partial lines
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              responseChunks.push(data.message.content);
              // Build full response only when needed for callback
              const fullResponse = responseChunks.join('');
              onChunk(data.message.content, fullResponse);
            }
            if (data.done) {
              const fullResponse = responseChunks.join('');
              onDone(fullResponse);
              return fullResponse;
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            console.warn('Stream parse warning:', e.message);
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.message?.content) {
            responseChunks.push(data.message.content);
          }
        } catch (e) {
          // Ignore final parse errors
        }
      }

      const fullResponse = responseChunks.join('');
      onDone(fullResponse);
      return fullResponse;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Vision stream aborted');
        return null;
      }
      throw e;
    } finally {
      if (controller) {
        this.removeController(controller);
      }
    }
  }

  /**
   * Convert HTML element to base64 image using html2canvas
   * Lazy loads html2canvas to avoid bundle bloat
   */
  async captureElementToBase64(element, options = {}) {
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const canvas = await html2canvas(element, {
        scale: options.scale || 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: options.backgroundColor || '#ffffff',
        logging: false,
        ...options,
      });

      // Convert to base64 (without the data:image/png;base64, prefix for Ollama)
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      return dataUrl.split(',')[1];
    } catch (error) {
      console.error('Error capturing element:', error);
      return null;
    }
  }

  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  async imageUrlToBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();

// Export class for testing/custom instances
export { OllamaService };

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate lesson generation request
 * @param {object} request - The lesson request object
 * @returns {string[]} Array of validation error messages (empty if valid)
 */
export const validateLessonRequest = (request) => {
  const errors = [];

  if (!request) {
    errors.push('Request is required');
    return errors;
  }

  if (!request.topic?.trim()) {
    errors.push('Topic is required');
  } else if (request.topic.length > 500) {
    errors.push('Topic must be less than 500 characters');
  }

  if (request.complexity && !['beginner', 'intermediate', 'advanced'].includes(request.complexity)) {
    errors.push('Invalid complexity level (must be: beginner, intermediate, or advanced)');
  }

  if (request.model && typeof request.model !== 'string') {
    errors.push('Model must be a string');
  }

  return errors;
};

/**
 * Validate chat message before sending
 * @param {string} message - The message to validate
 * @returns {object} { valid: boolean, error?: string }
 */
export const validateChatMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: 'Message is too long (max 10000 characters)' };
  }

  return { valid: true };
};
