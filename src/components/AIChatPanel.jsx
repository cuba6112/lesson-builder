import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { Send, X, Bot, User, Sparkles, Loader2, Settings, Trash2, Wrench, CheckCircle, AlertCircle, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ollamaService, isVisionModel, OllamaConnectionError, OllamaModelError } from '../services/ollama';
import { generateBlockId, generateMessageId } from '../utils/ids';
import { loadChatHistory, saveChatHistory, loadAISettings, saveAISettings, clearChatHistory } from '../services/storage';
import { sanitizeTextInput, sanitizePromptInput } from '../utils/sanitize';
import {
  SYSTEM_PROMPTS,
  UI_MESSAGES,
  LESSON_PROMPTS,
  BLOCK_PROMPTS,
  THINKING_MESSAGES,
  getIconForTopic,
  AGENT,
  IKA_MESSAGES,
} from '../config/prompts';

// Tool definitions for the AI agent (minimal set - 5 essential tools)
const TOOLS = {
  // Lesson Metadata
  set_lesson_title: {
    name: 'set_lesson_title',
    description: 'Set the lesson title',
    parameters: {
      title: { type: 'string', description: 'The new lesson title', required: true }
    },
  },
  set_lesson_icon: {
    name: 'set_lesson_icon',
    description: 'Set the lesson icon emoji',
    parameters: {
      icon: { type: 'string', description: 'The emoji icon (e.g., "📚", "🐍", "💡")', required: true }
    },
  },

  // Content Creation & Modification
  create_block: {
    name: 'create_block',
    description: 'Create a new content block. Use HTML for rich content (headings, tables, code, styled cards, quizzes, etc.)',
    parameters: {
      content: { type: 'string', description: 'The HTML content for the block', required: true },
    },
  },
  update_block: {
    name: 'update_block',
    description: 'Update an existing block by index (0 = first block)',
    parameters: {
      index: { type: 'number', description: 'Block index (0-based)', required: true },
      content: { type: 'string', description: 'The new HTML content', required: true }
    },
  },
  delete_block: {
    name: 'delete_block',
    description: 'Delete a block by index',
    parameters: {
      index: { type: 'number', description: 'Block index to delete (0-based)', required: true }
    },
  },
  create_code_block: {
    name: 'create_code_block',
    description: 'Create a code snippet block with syntax highlighting',
    parameters: {
      code: { type: 'string', description: 'The code content', required: true },
      language: { type: 'string', description: 'Programming language (javascript, python, html, css, etc.)', required: true },
      filename: { type: 'string', description: 'Optional filename to display (e.g., "app.js")', required: false }
    },
  },
  create_react_block: {
    name: 'create_react_block',
    description: 'Create an interactive React component. Available: Button, Card, Badge, Progress, Alert, Input, Quiz, Counter, Toggle, Tabs. Just write JSX directly - no render() needed.',
    parameters: {
      code: { type: 'string', description: 'JSX code. Examples: "<Counter />" or "<Quiz question="What is 2+2?" options={["3","4","5"]} correctIndex={1} />"', required: true }
    },
  },
  create_mermaid_block: {
    name: 'create_mermaid_block',
    description: 'Create a Mermaid diagram block. Supports: flowchart (graph TD/LR), sequence, class, state, ER, gantt, pie, mindmap diagrams.',
    parameters: {
      code: { type: 'string', description: 'Mermaid diagram code. Examples: "graph TD\\n    A[Start] --> B{Decision}\\n    B -->|Yes| C[End]" or "sequenceDiagram\\n    Alice->>Bob: Hello\\n    Bob-->>Alice: Hi!"', required: true }
    },
  },
};

// =============================================================================
// TOOL-CALLING AGENT SYSTEM
// =============================================================================

/**
 * Build a system prompt that instructs the AI to use tools
 */
const buildToolCallingPrompt = (tools, context = {}) => {
  const toolDescriptions = Object.entries(tools)
    .map(([name, tool]) => {
      const params = Object.entries(tool.parameters || {})
        .map(([pName, pDef]) => `    - ${pName} (${pDef.type}${pDef.required ? ', required' : ''}): ${pDef.description}`)
        .join('\n');
      return `- ${name}: ${tool.description}${params ? '\n  Parameters:\n' + params : ''}`;
    })
    .join('\n\n');

  return `You are Ika 🦑, an AI agent that creates educational content by executing tools.

## Current Lesson Context
- Title: ${context.lessonTitle || 'Untitled'}
- Icon: ${context.lessonIcon || '📚'}
- Blocks: ${context.blockCount || 0}

## Available Tools
${toolDescriptions}

## Response Format
You MUST respond with a JSON object containing:
1. "thought": Your brief reasoning about what to do
2. "tool_calls": An array of tool calls to execute (can be empty for simple responses)
3. "message": A brief message to show the user

Example response for "Create a lesson about Python":
\`\`\`json
{
  "thought": "User wants a Python lesson. I'll set the title, add a header, introduction, and content.",
  "tool_calls": [
    {"tool": "set_lesson_title", "params": {"title": "Introduction to Python"}},
    {"tool": "set_lesson_icon", "params": {"icon": "🐍"}},
    {"tool": "create_html_block", "params": {"content": "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 16px; text-align: center;'><h1 style='color: white; font-size: 2.5em; margin: 0;'>Introduction to Python</h1><p style='color: rgba(255,255,255,0.9); margin-top: 10px;'>Learn the basics of Python programming</p></div>"}},
    {"tool": "create_html_block", "params": {"content": "<div style='background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;'><h2>📖 What is Python?</h2><p>Python is a versatile, beginner-friendly programming language...</p></div>"}}
  ],
  "message": "I've created a Python lesson with a header and introduction!"
}
\`\`\`

Example response for a question "What's on the canvas?":
\`\`\`json
{
  "thought": "User is asking about the current canvas content. I should describe what I see.",
  "tool_calls": [],
  "message": "I can see your lesson titled '${context.lessonTitle || 'Untitled'}' with ${context.blockCount || 0} blocks."
}
\`\`\`

IMPORTANT:
- Always respond with valid JSON
- For content creation, use create_html_block with styled HTML
- Execute multiple tools in one response when needed
- Keep messages brief and friendly
- Use the color palette: blue (#3b82f6), green (#10b981), amber (#f59e0b), purple (#8b5cf6)`;
};

/**
 * Parse tool calls from AI response
 * Returns { thought, toolCalls, message, raw }
 */
const parseToolCalls = (response) => {
  if (!response) {
    return { thought: null, toolCalls: [], message: 'No response', raw: response };
  }

  try {
    // Try to extract JSON from the response
    let jsonStr = response;

    // Check if response contains markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object in the response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      thought: parsed.thought || null,
      toolCalls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
      message: parsed.message || 'Done',
      raw: response,
    };
  } catch (e) {
    // If parsing fails, treat the entire response as a message
    console.warn('Failed to parse tool calls, treating as plain message:', e.message);
    return {
      thought: null,
      toolCalls: [],
      message: response,
      raw: response,
    };
  }
};

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Render markdown to safe HTML
const renderMarkdown = (content) => {
  if (!content) return '';
  const html = marked.parse(content);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a', 'blockquote', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
};

// Tool Result Component
const ToolResult = memo(({ tool, result, success }) => (
  <div className={`text-xs p-2 rounded-lg border ${success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} mt-2`}>
    <div className="flex items-center gap-1 font-medium mb-1">
      {success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
      <span>{tool}</span>
    </div>
    <div className="text-xs opacity-80 whitespace-pre-wrap">
      {typeof result === 'object' ? JSON.stringify(result, null, 2).slice(0, 200) : String(result).slice(0, 200)}
      {(typeof result === 'object' ? JSON.stringify(result).length : String(result).length) > 200 && '...'}
    </div>
  </div>
));

ToolResult.displayName = 'ToolResult';

// Message component
const ChatMessage = memo(({ message }) => {
  const isUser = message.role === 'user';
  const isThinking = message.isThinking;
  const isStatus = message.isStatus || isThinking;

  // Memoize markdown rendering for assistant messages
  const renderedContent = useMemo(() => {
    if (isUser || isThinking || isStatus) return null;
    return renderMarkdown(message.content);
  }, [message.content, isUser, isThinking, isStatus]);

  if (isStatus) {
    return (
      <div className="flex items-center gap-2 text-sm text-purple-600">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-purple-500">
          <Loader2 size={14} className={isThinking ? 'animate-spin' : ''} />
        </div>
        <span>{message.content || 'Working...'}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''} animate-messageIn`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-100 text-blue-600' : isThinking ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white' : 'bg-purple-100 text-purple-600'
      }`}>
        {isUser ? <User size={16} /> : isThinking ? <Sparkles size={16} className="animate-pulse" /> : <Bot size={16} />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block w-full max-w-full sm:max-w-[85%] px-4 py-2 rounded-2xl break-words ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isThinking
            ? 'bg-gradient-to-br from-purple-50 to-blue-50 text-gray-800 rounded-bl-md border border-purple-200'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}>
          {isUser || isThinking ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div
              className="text-sm prose prose-sm prose-gray max-w-none break-words [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>pre]:my-2 [&>pre]:bg-gray-800 [&>pre]:text-gray-100 [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto [&>pre]:whitespace-pre-wrap [&>code]:bg-gray-200 [&>code]:px-1 [&>code]:rounded [&>code]:break-words [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>blockquote]:border-l-2 [&>blockquote]:border-purple-400 [&>blockquote]:pl-2 [&>blockquote]:italic"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          )}
        </div>

        {/* Tool calls and results */}
        {message.toolCalls && message.toolCalls.map((tc, i) => (
          <ToolResult key={`${message.id}-tool-${i}`} tool={tc.tool} result={tc.result} success={tc.success} />
        ))}

        {/* Image preview if present */}
        {message.images && message.images.length > 0 && (
          <div className="mt-2">
            <img
              src={message.imageUrl || `data:image/jpeg;base64,${message.images[0]}`}
              alt="Attached"
              className="max-w-[200px] rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Attachment previews */}
        {message.attachmentPreviews && message.attachmentPreviews.length > 0 && (
          <div className={`mt-2 flex gap-2 flex-wrap ${isUser ? 'justify-end' : ''}`}>
            {message.attachmentPreviews.map((preview, i) => (
              <img
                key={`preview-${i}`}
                src={preview}
                alt="Attachment"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
              />
            ))}
          </div>
        )}

        {/* Attachment badges */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`mt-2 flex gap-1 flex-wrap ${isUser ? 'justify-end' : ''}`}>
            {message.attachments.map((att, i) => (
              <span
                key={`att-${i}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  isUser ? 'bg-blue-500/20 text-blue-100' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {att.type === 'pdf' ? <FileText size={10} /> : <ImageIcon size={10} />}
                {att.name}
                {att.pages && ` (${att.pages}p)`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Main AI Chat Panel
export default function AIChatPanel({
  isOpen,
  onClose,
  blocks,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  // onMoveBlock - reserved for future drag-and-drop
  onSetTitle,
  onSetIcon,
  lessonTitle,
  lessonIcon,
  lessonId,     // Lesson ID for chat persistence
}) {
  // Load saved settings
  const savedSettings = loadAISettings();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(savedSettings.model || 'gpt-oss:20b');
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [useAgentMode, setUseAgentMode] = useState(true); // Use tool-based agent
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const prevLessonIdRef = useRef(lessonId);

  // Throttling refs for streaming updates
  const lastProgressUpdateRef = useRef(0);
  const lastToolUpdateRef = useRef(0);
  const pendingProgressUpdateRef = useRef(null);
  const pendingToolUpdateRef = useRef(null);

  // Load chat history when lesson changes or on mount
  useEffect(() => {
    // Skip if same lesson (prevents re-runs)
    if (lessonId === prevLessonIdRef.current && prevLessonIdRef.current !== undefined) {
      return;
    }

    const savedMessages = lessonId ? loadChatHistory(lessonId) : [];
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    } else {
      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: UI_MESSAGES.welcome
      }]);
    }
    prevLessonIdRef.current = lessonId;
  }, [lessonId]);

  // Save chat history when messages change
  useEffect(() => {
    if (lessonId && messages.length > 0) {
      // Don't save thinking messages
      const messagesToSave = messages.filter(m => !m.isThinking);
      if (messagesToSave.length > 0) {
        saveChatHistory(lessonId, messagesToSave);
      }
    }
  }, [messages, lessonId]);

  // Save settings when they change
  useEffect(() => {
    saveAISettings({
      model: selectedModel,
    });
  }, [selectedModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ollamaService.abortAll();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Tool execution engine (5 essential tools)
  const executeTool = useCallback(async (toolName, parameters) => {
    console.log('Executing tool:', toolName, parameters);

    switch (toolName) {
      case 'set_lesson_title':
        onSetTitle(parameters.title);
        return { success: true, result: `Title: "${parameters.title}"` };

      case 'set_lesson_icon':
        onSetIcon(parameters.icon);
        return { success: true, result: `Icon: ${parameters.icon}` };

      case 'create_block':
        onAddBlock({
          type: 'html',
          content: parameters.content,
          showPreview: true
        });
        return { success: true, result: 'Block created' };

      case 'update_block': {
        const index = parameters.index;
        if (index < 0 || index >= blocks.length) {
          return { success: false, result: `Invalid index: ${index}` };
        }
        const blockId = blocks[index].id;
        onUpdateBlock(blockId, 'content', parameters.content);
        return { success: true, result: `Block ${index} updated` };
      }

      case 'delete_block': {
        const index = parameters.index;
        if (index < 0 || index >= blocks.length) {
          return { success: false, result: `Invalid index: ${index}` };
        }
        onDeleteBlock(blocks[index].id);
        return { success: true, result: `Block ${index} deleted${blocks.length === 1 ? ' (canvas reset)' : ''}` };
      }

      case 'create_code_block': {
        const codeBlock = {
          type: 'code',
          content: parameters.code || '',
          language: parameters.language || 'javascript',
          filename: parameters.filename || '',
        };
        onAddBlock(codeBlock);
        return { success: true, result: 'Code block created' };
      }

      case 'create_react_block': {
        const reactBlock = {
          type: 'react',
          content: parameters.code || '<Button>Click me!</Button>',
        };
        onAddBlock(reactBlock);
        return { success: true, result: 'Interactive React block created' };
      }

      case 'create_mermaid_block': {
        const mermaidBlock = {
          type: 'mermaid',
          content: parameters.code || 'graph TD\n    A[Start] --> B[End]',
        };
        onAddBlock(mermaidBlock);
        return { success: true, result: 'Mermaid diagram block created' };
      }

      default:
        return { success: false, result: `Unknown tool: ${toolName}` };
    }
  }, [blocks, onAddBlock, onUpdateBlock, onDeleteBlock, onSetTitle, onSetIcon]);

  // Memoize system prompt - only rebuild when lesson metadata changes
  const systemPrompt = useMemo(() => {
    const context = {
      lessonTitle,
      lessonIcon,
      blockCount: blocks.length,
    };
    return buildToolCallingPrompt(TOOLS, context);
  }, [lessonTitle, lessonIcon, blocks.length]);

  // Run the AI agent with tool execution (streaming for faster feedback)
  const runAgentWithTools = useCallback(async (userMessage, options = {}) => {
    const { signal, onToolExecuted, onProgress, conversationHistory = [] } = options;

    // Build messages with conversation history for context
    // Filter out thinking/status messages and limit to last 6-8 messages (3-4 exchanges)
    const historyMessages = conversationHistory
      .filter(m => !m.isThinking && !m.isStatus && m.content)
      .slice(-8)  // Keep last 8 messages (4 exchanges) - reduced from 20 for performance
      .map(m => ({
        role: m.role,
        content: m.role === 'assistant' && m.toolCalls
          ? `${m.content}\n[Previously used tools: ${m.toolCalls.map(t => t.tool).join(', ')}]`
          : m.content
      }));

    // Get AI response with full context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ];

    let fullResponse = '';

    try {
      // Use streaming for faster feedback, parse JSON at the end
      await ollamaService.chatStream(
        messages,
        selectedModel,
        (chunk, accumulated) => {
          // Show progress as chunks arrive
          onProgress?.(accumulated.length);
        },
        (final) => {
          fullResponse = final;
        },
        signal
      );

      // Parse tool calls from response
      const { thought, toolCalls, message } = parseToolCalls(fullResponse);

      console.log('Agent response:', { thought, toolCalls: toolCalls.length, message });

      // Execute each tool call
      const toolResults = [];
      for (const call of toolCalls) {
        if (signal?.aborted) break;

        const toolName = call.tool;
        const params = call.params || {};

        try {
          const result = await executeTool(toolName, params);
          toolResults.push({ tool: toolName, ...result });
          onToolExecuted?.(toolName, result);
        } catch (toolError) {
          console.error(`Tool ${toolName} failed:`, toolError);
          toolResults.push({ tool: toolName, success: false, result: toolError.message });
        }
      }

      // Return the agent's message and tool results
      return {
        message,
        thought,
        toolResults,
        toolCalls,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { message: 'Cancelled', toolResults: [] };
      }
      throw error;
    }
  }, [systemPrompt, selectedModel, executeTool]);

  // Convert image file to base64
  const imageToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Convert PDF to images using pdfjs
  const pdfToImages = useCallback(async (file) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images = [];

      // Limit to first 5 pages to avoid memory issues
      const maxPages = Math.min(pdf.numPages, 5);

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        const base64 = canvas.toDataURL('image/png', 0.8).split(',')[1];
        images.push({
          base64,
          pageNum: i,
          totalPages: pdf.numPages
        });
      }

      return images;
    } catch (error) {
      console.error('Failed to process PDF:', error);
      throw error;
    }
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessingFiles(true);

    try {
      const processedFiles = [];

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const base64 = await imageToBase64(file);
          processedFiles.push({
            id: generateMessageId(),
            type: 'image',
            name: file.name,
            base64,
            preview: URL.createObjectURL(file)
          });
        } else if (file.type === 'application/pdf') {
          const pdfImages = await pdfToImages(file);
          processedFiles.push({
            id: generateMessageId(),
            type: 'pdf',
            name: file.name,
            pages: pdfImages,
            preview: null // PDFs don't have a simple preview
          });
        }
      }

      setAttachedFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Failed to process files:', error);
    } finally {
      setIsProcessingFiles(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [imageToBase64, pdfToImages]);

  // Remove attached file
  const removeAttachedFile = useCallback((fileId) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  // Clear all attached files
  const clearAttachedFiles = useCallback(() => {
    attachedFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setAttachedFiles([]);
  }, [attachedFiles]);

  // Check Ollama connection and fetch models
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const modelList = await ollamaService.getModels();
        if (modelList.length > 0) {
          setModels(modelList);
          setConnectionStatus('connected');

          // Select first available model if current selection isn't in the list
          const currentModelExists = modelList.some(m => m.name === selectedModel);
          if (!currentModelExists && modelList.length > 0) {
            setSelectedModel(modelList[0].name);
          }
        } else {
          setConnectionStatus('no_models');
        }
      } catch {
        setConnectionStatus('disconnected');
      }
    };

    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, selectedModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Helper to wait for React state update
  const wait = useCallback((ms) => new Promise(resolve => setTimeout(resolve, ms)), []);

  // Throttle helper for streaming updates (~3-4 updates/second = 250-333ms)
  const THROTTLE_MS = 300;

  const throttledProgressUpdate = useCallback((thinkingId, content) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastProgressUpdateRef.current;

    if (timeSinceLastUpdate >= THROTTLE_MS) {
      // Execute immediately
      lastProgressUpdateRef.current = now;
      setMessages(prev => prev.map(m =>
        m.id === thinkingId ? { ...m, content } : m
      ));
    } else {
      // Queue for later execution
      if (pendingProgressUpdateRef.current) {
        clearTimeout(pendingProgressUpdateRef.current);
      }
      pendingProgressUpdateRef.current = setTimeout(() => {
        lastProgressUpdateRef.current = Date.now();
        setMessages(prev => prev.map(m =>
          m.id === thinkingId ? { ...m, content } : m
        ));
        pendingProgressUpdateRef.current = null;
      }, THROTTLE_MS - timeSinceLastUpdate);
    }
  }, []);

  const throttledToolUpdate = useCallback((thinkingId, content) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastToolUpdateRef.current;

    if (timeSinceLastUpdate >= THROTTLE_MS) {
      // Execute immediately
      lastToolUpdateRef.current = now;
      setMessages(prev => prev.map(m =>
        m.id === thinkingId ? { ...m, content } : m
      ));
    } else {
      // Queue for later execution
      if (pendingToolUpdateRef.current) {
        clearTimeout(pendingToolUpdateRef.current);
      }
      pendingToolUpdateRef.current = setTimeout(() => {
        lastToolUpdateRef.current = Date.now();
        setMessages(prev => prev.map(m =>
          m.id === thinkingId ? { ...m, content } : m
        ));
        pendingToolUpdateRef.current = null;
      }, THROTTLE_MS - timeSinceLastUpdate);
    }
  }, []);

  // Cleanup throttle timers on unmount
  useEffect(() => {
    return () => {
      if (pendingProgressUpdateRef.current) {
        clearTimeout(pendingProgressUpdateRef.current);
      }
      if (pendingToolUpdateRef.current) {
        clearTimeout(pendingToolUpdateRef.current);
      }
    };
  }, []);

  // Unified thinking state management
  const updateThinking = useCallback((text) => {
    setMessages(prev => {
      const withoutThinking = prev.filter(m => !m.isThinking && !m.isStatus);
      return [...withoutThinking, { id: generateMessageId(), role: 'assistant', content: text, isThinking: true }];
    });
  }, []);

  // Stream content directly to canvas with thinking in chat
  const streamToCanvas = useCallback(async (userInput, { silent = false, force = false } = {}) => {
    // Create abort controller for this operation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const addProgress = silent ? () => {} : updateThinking;
    const streamHtmlToBlock = async (prompt, blockId) => {
      let fullResponse = '';
      try {
        await ollamaService.chatStream(
          [{ role: 'user', content: prompt }],
          selectedModel,
          (chunk, cumulative) => {
            fullResponse = cumulative;
            const match = cumulative.match(/<[^>]+[\s\S]*<\/[^>]+>/);
            onUpdateBlock(blockId, 'content', match ? match[0] : cumulative);
          },
          () => {},
          signal
        );
      } catch (e) {
        if (e.name === 'AbortError') return null;
        throw e;
      }
      return fullResponse;
    };

    // Detect intent
    const lowerInput = userInput.toLowerCase();
    const isCreateLesson = lowerInput.includes('create') || lowerInput.includes('make') || lowerInput.includes('write') || lowerInput.includes('generate');
    const isAddBlock = lowerInput.includes('add') || lowerInput.includes('insert');

    // Extract topic
    const topicMatch = userInput.match(/(?:about|on|for|explaining|regarding)\s+(.+?)(?:\.|$)/i);
    const topic = topicMatch ? topicMatch[1].trim() : userInput.replace(/^(create|make|write|add|generate)\s*(a\s*)?(lesson|block|section|heading|text|quiz|table|html|code|list)?\s*(about|on|for)?\s*/i, '').trim();

    if (isCreateLesson) {
      const title = topic.charAt(0).toUpperCase() + topic.slice(1);

      // Start thinking in chat
      addProgress(THINKING_MESSAGES.lessonPlanning(title));
      await wait(100);

      if (signal.aborted) return null;

      // Set title and icon
      addProgress(THINKING_MESSAGES.lessonSetTitle(title));
      onSetTitle(title);

      const icon = getIconForTopic(topic);
      onSetIcon(icon);

      // STEP 1: Create Title Block
      addProgress(THINKING_MESSAGES.lessonStep1());

      if (signal.aborted) return null;

      const titleBlockId = generateBlockId();
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingTitle, showPreview: true }, null, titleBlockId);
      await wait(50);

      await streamHtmlToBlock(LESSON_PROMPTS.title(topic), titleBlockId);

      // STEP 2: Introduction & Learning Objectives
      addProgress(THINKING_MESSAGES.lessonStep2());

      if (signal.aborted) return null;

      const introBlockId = generateBlockId();
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingIntro, showPreview: true }, null, introBlockId);
      await wait(50);

      await streamHtmlToBlock(LESSON_PROMPTS.introduction(topic), introBlockId);

      // STEP 3: Main Content
      addProgress(THINKING_MESSAGES.lessonStep3());

      if (signal.aborted) return null;

      const mainBlockId = generateBlockId();
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingMain, showPreview: true }, null, mainBlockId);
      await wait(50);

      await streamHtmlToBlock(LESSON_PROMPTS.mainContent(topic), mainBlockId);

      // STEP 4: Quiz
      addProgress(THINKING_MESSAGES.lessonStep4());

      if (signal.aborted) return null;

      const quizBlockId = generateBlockId();
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingQuiz, showPreview: true }, null, quizBlockId);
      await wait(50);

      await streamHtmlToBlock(LESSON_PROMPTS.quizSection(topic), quizBlockId);

      // Final message
      addProgress(THINKING_MESSAGES.lessonComplete(title));

      return null;
    } else if (isAddBlock || force) {
      const blockId = generateBlockId();

      if (!force && lowerInput.includes('heading')) {
        addProgress(THINKING_MESSAGES.addingHeading());
        onAddBlock({ type: 'heading', content: '' }, null, blockId);
        await wait(50);

        try {
          await ollamaService.chatStream(
            [{ role: 'user', content: BLOCK_PROMPTS.heading(topic) }],
            selectedModel,
            (chunk, full) => onUpdateBlock(blockId, 'content', full.trim()),
            () => {},
            signal
          );
        } catch (e) {
          if (e.name === 'AbortError') return null;
          throw e;
        }

        addProgress(THINKING_MESSAGES.headingAdded());
        return null;
      } else if (!force && (lowerInput.includes('html') || lowerInput.includes('table') || lowerInput.includes('code') || lowerInput.includes('list') || lowerInput.includes('card') || lowerInput.includes('box'))) {
        const htmlType = lowerInput.includes('table') ? 'table' :
                        lowerInput.includes('code') ? 'code example' :
                        lowerInput.includes('list') ? 'list' :
                        lowerInput.includes('card') ? 'info card' :
                        lowerInput.includes('box') ? 'content box' : 'HTML block';

        addProgress(THINKING_MESSAGES.addingHtml(htmlType));

        onAddBlock({ type: 'html', content: UI_MESSAGES.loadingBlock(htmlType), showPreview: true }, null, blockId);
        await wait(50);

        // Build the prompt with type-specific additions
        let typeSpecificPrompt = '';
        if (lowerInput.includes('table')) typeSpecificPrompt = BLOCK_PROMPTS.table;
        else if (lowerInput.includes('code')) typeSpecificPrompt = BLOCK_PROMPTS.code;
        else if (lowerInput.includes('list')) typeSpecificPrompt = BLOCK_PROMPTS.list;
        else if (lowerInput.includes('card') || lowerInput.includes('box')) typeSpecificPrompt = BLOCK_PROMPTS.card;

        const fullPrompt = BLOCK_PROMPTS.htmlBase(htmlType, topic) + (typeSpecificPrompt ? `\n\n${typeSpecificPrompt}` : '');

        await streamHtmlToBlock(fullPrompt, blockId);

        addProgress(THINKING_MESSAGES.htmlAdded(htmlType));
        return null;
      } else if (!force && lowerInput.includes('quiz')) {
        addProgress(THINKING_MESSAGES.addingQuiz());

        onAddBlock({ type: 'html', content: UI_MESSAGES.loadingQuiz, showPreview: true }, null, blockId);
        await wait(50);

        await streamHtmlToBlock(BLOCK_PROMPTS.quiz(topic), blockId);

        addProgress(THINKING_MESSAGES.quizAdded());
        return null;
      } else {
        // Default to styled HTML content block
        addProgress(THINKING_MESSAGES.addingContent());

        onAddBlock({ type: 'html', content: UI_MESSAGES.loadingContent, showPreview: true }, null, blockId);
        await wait(50);

        await streamHtmlToBlock(BLOCK_PROMPTS.content(topic), blockId);

        addProgress(THINKING_MESSAGES.contentAdded());
        return null;
      }
    }

    return null;
  }, [selectedModel, onSetTitle, onSetIcon, onAddBlock, onUpdateBlock, updateThinking, wait]);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    // Capture conversation history before modifying messages state
    const conversationHistory = [...messages];

    // Sanitize user input before processing
    const userInput = sanitizePromptInput(input);
    const displayInput = sanitizeTextInput(input);

    // Collect all images from attachments
    const attachmentImages = [];
    const attachmentInfo = [];
    for (const file of attachedFiles) {
      if (file.type === 'image') {
        attachmentImages.push(file.base64);
        attachmentInfo.push({ type: 'image', name: file.name });
      } else if (file.type === 'pdf') {
        for (const page of file.pages) {
          attachmentImages.push(page.base64);
        }
        attachmentInfo.push({ type: 'pdf', name: file.name, pages: file.pages.length });
      }
    }

    // Build attachment previews as stable data URLs so cleanup won't break chat history
    const attachmentPreviews = attachedFiles
      .filter(f => f.type === 'image')
      .map(f => (f.base64 ? `data:image/*;base64,${f.base64}` : f.preview))
      .filter(Boolean);

    // Create user message with attachment previews (use sanitized display input)
    const userMessage = {
      id: generateMessageId(),
      role: 'user',
      content: displayInput || 'Analyze these files',
      hasVisionContext: true,
      attachments: attachmentInfo.length > 0 ? attachmentInfo : undefined,
      attachmentPreviews: attachmentPreviews.length > 0 ? attachmentPreviews : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    clearAttachedFiles();
    setIsLoading(true);

    try {
      // Remove any lingering thinking/status messages, then show status for this request
      const thinkingId = generateMessageId();
      setMessages(prev => [
        ...prev.filter(m => !m.isThinking && !m.isStatus),
        {
          id: thinkingId,
          role: 'assistant',
          content: 'Thinking...',
          isThinking: true,
          isStatus: true
        }
      ]);

      // =========================================
      // AGENT MODE: Use tool-based execution
      // =========================================
      if (useAgentMode) {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
          // Run the agent with streaming progress and conversation history
          const result = await runAgentWithTools(userInput, {
            signal,
            conversationHistory,
            onProgress: (chars) => {
              // Update thinking message with progress dots (throttled to ~3-4 updates/second)
              const dots = '.'.repeat((Math.floor(chars / 50) % 3) + 1);
              throttledProgressUpdate(thinkingId, `🦑 Thinking${dots}`);
            },
            onToolExecuted: (toolName, toolResult) => {
              console.log('Tool executed:', toolName, toolResult);
              // Show tool execution in thinking message (throttled to ~3-4 updates/second)
              throttledToolUpdate(thinkingId, `🔧 Running ${toolName}...`);
            },
          });

          // Remove thinking and show result
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId);
            return [...filtered, {
              id: generateMessageId(),
              role: 'assistant',
              content: result.message,
              toolCalls: result.toolResults?.map(tr => ({
                tool: tr.tool,
                result: tr.result,
                success: tr.success,
              })),
            }];
          });

          return;
        } catch (agentError) {
          if (agentError.name === 'AbortError') {
            setMessages(prev => prev.filter(m => m.id !== thinkingId));
            return;
          }

          console.error('Agent error:', agentError);

          // Surface error to user instead of falling back
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId);
            return [...filtered, {
              id: generateMessageId(),
              role: 'assistant',
              content: `❌ Agent mode encountered an error: ${agentError.message}\n\nPlease try again, or disable Agent Mode in settings to use legacy mode.`
            }];
          });

          return;
        }
      }

      // =========================================
      // LEGACY MODE: Chat with optional vision for attachments
      // Only used when agent mode is disabled
      // =========================================
      const hasAttachments = attachmentImages.length > 0;
      const modelSupportsVision = isVisionModel(selectedModel);

      if (hasAttachments && modelSupportsVision) {
        // Use vision API when we have attachments and model supports it
        const visionMessages = [
          { role: 'system', content: SYSTEM_PROMPTS.assistant },
          {
            role: 'user',
            content: userInput || 'Please analyze these files.',
            images: attachmentImages
          }
        ];

        await ollamaService.chatStreamWithVision(
          visionMessages,
          selectedModel,
          () => {},
          (finalResponse) => {
            setMessages(prev => {
              const updated = prev.map(m =>
                m.id === thinkingId
                  ? { ...m, content: 'Done', isThinking: false, isStatus: true, hasVisionContext: true }
                  : m
              );
              return [...updated, {
                id: generateMessageId(),
                role: 'assistant',
                content: finalResponse,
                hasVisionContext: true
              }];
            });
          }
        );
      } else if (hasAttachments && !modelSupportsVision) {
        // Warn user that attachments won't be processed
        setMessages(prev => {
          const updated = prev.map(m =>
            m.id === thinkingId
              ? { ...m, content: 'Done', isThinking: false, isStatus: true }
              : m
          );
          return [...updated, {
            id: generateMessageId(),
            role: 'assistant',
            content: `⚠️ The current model (${selectedModel}) doesn't support vision. Your attachments were received but cannot be analyzed. Consider switching to a vision model like \`llava\`, \`llava-llama3\`, or \`moondream\` to analyze images and PDFs.`
          }];
        });
      } else {
        // Regular text chat
        await ollamaService.chatStream(
          [
            { role: 'system', content: SYSTEM_PROMPTS.assistant },
            { role: 'user', content: userInput }
          ],
          selectedModel,
          () => {},
          (finalResponse) => {
            setMessages(prev => {
              const updated = prev.map(m =>
                m.id === thinkingId
                  ? { ...m, content: 'Done', isThinking: false, isStatus: true }
                  : m
              );
              return [...updated, {
                id: generateMessageId(),
                role: 'assistant',
                content: finalResponse
              }];
            });
          }
        );
      }

    } catch (error) {
      console.error('Error:', error);

      // Determine error message based on error type
      let errorMessage;
      if (error instanceof OllamaConnectionError) {
        errorMessage = IKA_MESSAGES.errors.connection;
      } else if (error instanceof OllamaModelError) {
        errorMessage = `Model error: ${error.message}`;
      } else if (error.name === 'AbortError') {
        errorMessage = IKA_MESSAGES.errors.aborted;
      } else {
        errorMessage = IKA_MESSAGES.errors.generic(error.message);
      }

      // Remove thinking and add error message
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking);
        return [...filtered, {
          id: generateMessageId(),
          role: 'assistant',
          content: errorMessage
        }];
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, selectedModel, attachedFiles, clearAttachedFiles, streamToCanvas, useAgentMode, runAgentWithTools, messages, throttledProgressUpdate, throttledToolUpdate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const clearChat = useCallback(() => {
    setMessages([{
      id: generateMessageId(),
      role: 'assistant',
      content: UI_MESSAGES.chatCleared
    }]);
    // Also clear from storage
    if (lessonId) {
      clearChatHistory(lessonId);
    }
  }, [lessonId]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleModelChange = useCallback((e) => {
    setSelectedModel(e.target.value);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col animate-slideIn">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-1">
              {AGENT.name} {AGENT.avatar}
              <Wrench size={12} className="text-purple-500" />
            </h3>
            <p className="text-xs text-gray-500">
              {connectionStatus === 'connected' ? (
                <span className="text-green-600">{AGENT.role}</span>
              ) : connectionStatus === 'checking' ? (
                <span className="text-yellow-600">Connecting...</span>
              ) : (
                <span className="text-red-600">Ollama not running</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSettings}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Clear chat"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="shrink-0 p-4 bg-gray-50 border-b border-gray-100 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Model</label>
            <select
              value={selectedModel}
              onChange={handleModelChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
              {models.length === 0 && (
                <>
                  <option value="gpt-oss:20b">gpt-oss:20b</option>
                  <option value="qwen3:8b">qwen3:8b</option>
                  <option value="llama3.2">llama3.2</option>
                </>
              )}
            </select>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Agent Mode</label>
              <button
                onClick={() => setUseAgentMode(prev => !prev)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  useAgentMode ? 'bg-purple-500' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  useAgentMode ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {useAgentMode
                ? '🦑 Agent mode: AI executes tools to modify lesson'
                : '📝 Legacy mode: Direct content streaming'
              }
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <strong>Available tools:</strong> {Object.keys(TOOLS).length} tools
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-gray-100 bg-white">
        {/* Attached Files Preview */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group bg-gray-100 rounded-lg p-2 flex items-center gap-2"
              >
                {file.type === 'image' && file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center">
                    <FileText size={20} className="text-red-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[100px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.type === 'pdf' ? `${file.pages?.length || 0} pages` : 'Image'}
                  </p>
                </div>
                <button
                  onClick={() => removeAttachedFile(file.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove file"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessingFiles && (
          <div className="mb-3 flex items-center gap-2 text-sm text-purple-600">
            <Loader2 size={14} className="animate-spin" />
            Processing files...
          </div>
        )}

        <div className="flex gap-2 items-start">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingFiles}
            className="px-3 py-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Attach file"
            title="Upload image or PDF"
          >
            <Paperclip size={18} />
          </button>

          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length > 0 ? "Add a message or send to analyze..." : "Ask me to create, edit, or analyze..."}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm"
              style={{ minHeight: '80px', maxHeight: '160px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          {AGENT.avatar} {AGENT.name} • {Object.keys(TOOLS).length} tools
        </p>
      </div>
    </div>
  );
}
