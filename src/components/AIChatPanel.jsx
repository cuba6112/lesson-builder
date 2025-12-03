// @ts-nocheck
import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Send, X, User, Loader2, Settings, Trash2, Wrench, CheckCircle, AlertCircle, Paperclip, FileText } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ollamaService, OllamaConnectionError, OllamaModelError, isVisionModel } from '../services/ollama';
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
  create_math_block: {
    name: 'create_math_block',
    description: 'Create a math formula block using LaTeX notation. Perfect for equations, formulas, and mathematical expressions.',
    parameters: {
      code: { type: 'string', description: 'LaTeX math code. Examples: "E = mc^2", "\\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}", "\\\\int_0^\\\\infty e^{-x^2} dx"', required: true }
    },
  },
  stream_html_block: {
    name: 'stream_html_block',
    description: 'Stream HTML content to canvas in real-time. Use for longer content that should appear progressively. Provide a prompt and the AI will generate and stream the content live.',
    parameters: {
      prompt: { type: 'string', description: 'What content to generate (e.g., "comprehensive introduction to machine learning with examples")', required: true },
      style: { type: 'string', description: 'Style hint: "header" for title blocks, "section" for content sections, "quiz" for interactive quizzes', required: false }
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
 * Find balanced JSON object in string (handles nested braces correctly)
 */
const findBalancedJson = (str) => {
  const start = str.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return str.slice(start, i + 1);
        }
      }
    }
  }

  return null; // Unbalanced
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
    // Strategy 1: Try to extract JSON from markdown code block
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const jsonStr = findBalancedJson(codeBlockMatch[1].trim());
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          return {
            thought: parsed.thought || null,
            toolCalls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
            message: parsed.message || 'Done',
            raw: response,
          };
        } catch {
          // Continue to next strategy
        }
      }
    }

    // Strategy 2: Find balanced JSON object in raw response
    const balancedJson = findBalancedJson(response);
    if (balancedJson) {
      try {
        const parsed = JSON.parse(balancedJson);
        return {
          thought: parsed.thought || null,
          toolCalls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
          message: parsed.message || 'Done',
          raw: response,
        };
      } catch {
        // Continue to next strategy
      }
    }

    // Strategy 3: Try to fix common JSON issues (trailing commas)
    if (balancedJson) {
      const fixedJson = balancedJson
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']'); // Remove trailing commas before ]
      try {
        const parsed = JSON.parse(fixedJson);
        return {
          thought: parsed.thought || null,
          toolCalls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
          message: parsed.message || 'Done',
          raw: response,
        };
      } catch {
        // Fall through to default
      }
    }

    // If all parsing fails, treat the entire response as a message
    console.warn('Failed to parse tool calls, treating as plain message');
    return {
      thought: null,
      toolCalls: [],
      message: response,
      raw: response,
    };
  } catch (e) {
    console.warn('parseToolCalls error:', e.message);
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
ToolResult.propTypes = {
  tool: PropTypes.string.isRequired,
  result: PropTypes.any,
  success: PropTypes.bool,
};

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
        {isUser ? <User size={16} /> : <span className="text-base">🦑</span>}
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
                <FileText size={10} />
                {att.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.string,
    content: PropTypes.string,
    isThinking: PropTypes.bool,
    isStatus: PropTypes.bool,
    toolCalls: PropTypes.array,
    attachments: PropTypes.array,
  }).isRequired,
};

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
  const [selectedModel, setSelectedModel] = useState(savedSettings.selectedModel);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [useAgentMode, setUseAgentMode] = useState(true); // Use tool-based agent
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const prevLessonIdRef = useRef(lessonId);


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

      case 'create_math_block': {
        const mathBlock = {
          type: 'math',
          content: parameters.code || 'E = mc^2',
        };
        onAddBlock(mathBlock);
        return { success: true, result: 'Math formula block created' };
      }

      case 'stream_html_block': {
        // Create a placeholder block first
        const blockId = generateBlockId();
        onAddBlock({
          type: 'html',
          content: '<div style="padding: 20px; text-align: center; color: #9ca3af;">⏳ Generating content...</div>',
          showPreview: true
        }, null, blockId);

        // Build the prompt based on style
        const styleHints = {
          header: 'Create a visually stunning header/title block with gradient background, large text, and professional styling.',
          section: 'Create an informative content section with clear headings, well-formatted paragraphs, and visual elements.',
          quiz: 'Create an interactive quiz section with styled question cards and answer options.',
        };

        const styleHint = styleHints[parameters.style] || styleHints.section;
        const fullPrompt = `${styleHint}

Topic: ${parameters.prompt}

IMPORTANT: Return ONLY valid HTML. Use inline styles. Make it visually appealing with:
- Modern colors and gradients
- Proper padding and margins
- Border-radius for rounded corners
- Box shadows for depth
- Emojis for visual interest

Do NOT include any markdown, code fences, or explanations. ONLY HTML.`;

        // Stream the response directly to the block
        try {
          await ollamaService.chatStream(
            [{ role: 'user', content: fullPrompt }],
            selectedModel,
            (_chunk, accumulated) => {
              // Extract HTML content (remove any accidental markdown)
              let html = accumulated;
              // Remove code fences if present
              html = html.replace(/```html?\n?/gi, '').replace(/```\n?/g, '');
              // Try to extract just the HTML
              const htmlMatch = html.match(/<[^>]+[\s\S]*$/);
              if (htmlMatch) {
                onUpdateBlock(blockId, 'content', htmlMatch[0]);
              } else if (html.trim()) {
                onUpdateBlock(blockId, 'content', html);
              }
            },
            () => {}
          );
          return { success: true, result: 'Content streamed to canvas' };
        } catch (streamError) {
          console.error('Stream error:', streamError);
          onUpdateBlock(blockId, 'content', '<div style="padding: 20px; color: #ef4444;">❌ Failed to generate content</div>');
          return { success: false, result: streamError.message };
        }
      }

      default:
        return { success: false, result: `Unknown tool: ${toolName}` };
    }
  }, [blocks, onAddBlock, onUpdateBlock, onDeleteBlock, onSetTitle, onSetIcon, selectedModel]);

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
    const { signal, onToolExecuted, onStreamChunk, conversationHistory = [] } = options;

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
      // Use streaming with real-time display
      await ollamaService.chatStream(
        messages,
        selectedModel,
        (chunk, accumulated) => {
          // Stream content in real-time to the UI
          onStreamChunk?.(accumulated);
        },
        (final) => {
          fullResponse = final;
        },
        signal
      );

      // Parse tool calls from response
      const { thought, toolCalls, message } = parseToolCalls(fullResponse);

      console.log('Agent response:', { thought, toolCalls: toolCalls.length, message });

      // Execute tool calls - parallelize independent tools for speed
      const toolResults = [];

      // Identify tools that can run in parallel (don't depend on canvas state)
      const parallelizableTools = ['set_lesson_title', 'set_lesson_icon'];
      const parallelCalls = toolCalls.filter(c => parallelizableTools.includes(c.tool));
      const sequentialCalls = toolCalls.filter(c => !parallelizableTools.includes(c.tool));

      // Execute parallelizable tools concurrently
      if (parallelCalls.length > 0 && !signal?.aborted) {
        const parallelResults = await Promise.all(
          parallelCalls.map(async (call) => {
            const toolName = call.tool;
            const params = call.params || {};
            try {
              const result = await executeTool(toolName, params);
              onToolExecuted?.(toolName, result);
              return { tool: toolName, ...result };
            } catch (toolError) {
              console.error(`Tool ${toolName} failed:`, toolError);
              return { tool: toolName, success: false, result: toolError.message };
            }
          })
        );
        toolResults.push(...parallelResults);
      }

      // Execute sequential tools (content blocks that may depend on order)
      for (const call of sequentialCalls) {
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



  // Extract text from PDF using pdfjs
  const extractPdfText = useCallback(async (file) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        // Run parsing on main thread; workerSrc is unset in Tauri so spawning would fail
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
      const textParts = [];

      // Extract text from all pages (limit to first 20 pages)
      const maxPages = Math.min(pdf.numPages, 20);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        if (pageText.trim()) {
          textParts.push(`[Page ${i}]\n${pageText}`);
        }
      }

      return textParts.join('\n\n');
    } catch (error) {
      console.error('Failed to extract PDF text:', error);
      return `[Error extracting PDF: ${error.message}]`;
    }
  }, []);

  // Convert file to base64 string (used for vision models)
  const fileToBase64 = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        // Strip data URL prefix if present
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      } else {
        reject(new Error('Unable to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  }), []);

  // Handle file selection - extract text content
  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessingFiles(true);

    try {
      const processedFiles = [];

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          let base64 = null;
          try {
            base64 = await fileToBase64(file);
          } catch (encodeError) {
            console.error('Failed to encode image:', encodeError);
          }

          const visionReady = isVisionModel(selectedModel || '');
          const imageNote = visionReady
            ? `[Image: ${file.name}] Ready for vision analysis.`
            : `[Image: ${file.name}] ⚠️ Image analysis requires a vision model (llava, llava-llama3, moondream). Switch to a vision model to analyze this image.`;

          processedFiles.push({
            id: generateMessageId(),
            type: 'image',
            name: file.name,
            text: imageNote,
            preview: URL.createObjectURL(file),
            base64,
            mimeType: file.type
          });
        } else if (file.type === 'application/pdf') {
          const text = await extractPdfText(file);
          processedFiles.push({
            id: generateMessageId(),
            type: 'pdf',
            name: file.name,
            text,
            preview: null
          });
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          const text = await file.text();
          processedFiles.push({
            id: generateMessageId(),
            type: 'text',
            name: file.name,
            text,
            preview: null
          });
        } else {
          // Try to read as text for other file types
          try {
            const text = await file.text();
            processedFiles.push({
              id: generateMessageId(),
              type: 'document',
              name: file.name,
              text,
              preview: null
            });
          } catch {
            processedFiles.push({
              id: generateMessageId(),
              type: 'unknown',
              name: file.name,
              text: `[Cannot read file: ${file.name}]`,
              preview: null
            });
          }
        }
      }

      setAttachedFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Failed to process files:', error);
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [extractPdfText, fileToBase64, selectedModel]);

  // Remove attached file
  const removeAttachedFile = useCallback((fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Clear all attached files
  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);


  // Debounced block updates to reduce React re-renders during streaming
  // eslint-disable-next-line no-unused-vars
  const _debouncedUpdateBlock = useMemo(() => {
    const timeouts = new Map();
    return (blockId, property, value) => {
      if (timeouts.has(blockId)) {
        clearTimeout(timeouts.get(blockId));
      }
      timeouts.set(blockId, setTimeout(() => {
        onUpdateBlock(blockId, property, value);
        timeouts.delete(blockId);
      }, 50)); // Batch updates every 50ms
    };
  }, [onUpdateBlock]);

  // Performance tracking for generation (available for debugging)
  // eslint-disable-next-line no-unused-vars
  const _performanceTracker = useRef({
    startTime: 0,
    blocksCompleted: 0,

    startGeneration() {
      this.startTime = performance.now();
      this.blocksCompleted = 0;
    },

    blockComplete() {
      this.blocksCompleted++;
      const elapsed = performance.now() - this.startTime;
      console.log(`Block ${this.blocksCompleted} completed in ${elapsed.toFixed(0)}ms`);
    },

    generationComplete() {
      const totalTime = performance.now() - this.startTime;
      console.log(`Total generation time: ${totalTime.toFixed(0)}ms for ${this.blocksCompleted} blocks`);
    }
  });

  // Unified thinking state management
  const updateThinking = useCallback((text) => {
    setMessages(prev => {
      const withoutThinking = prev.filter(m => !m.isThinking && !m.isStatus);
      return [...withoutThinking, { id: generateMessageId(), role: 'assistant', content: text, isThinking: true }];
    });
  }, []);

  // Stream content directly to canvas with thinking in chat (legacy mode - kept for reference)
  // eslint-disable-next-line no-unused-vars
  const _streamToCanvas = useCallback(async (userInput, { silent = false, force = false } = {}) => {
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

      if (signal.aborted) return null;

      // Set title and icon immediately (parallel)
      onSetTitle(title);
      const icon = getIconForTopic(topic);
      onSetIcon(icon);

      // PROGRESSIVE LOADING: Create ALL placeholder blocks immediately
      // This shows the user instant feedback while content streams in parallel
      addProgress('🚀 Creating lesson structure...');

      const titleBlockId = generateBlockId();
      const introBlockId = generateBlockId();
      const mainBlockId = generateBlockId();
      const quizBlockId = generateBlockId();

      // Create all placeholders at once (instant visual feedback)
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingTitle, showPreview: true }, null, titleBlockId);
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingIntro, showPreview: true }, null, introBlockId);
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingMain, showPreview: true }, null, mainBlockId);
      onAddBlock({ type: 'html', content: UI_MESSAGES.loadingQuiz, showPreview: true }, null, quizBlockId);

      if (signal.aborted) return null;

      // PARALLEL STREAMING: Stream all 4 blocks simultaneously
      // This is 3-4x faster than sequential streaming
      addProgress('⚡ Generating all sections in parallel...');

      // Create all streaming promises in parallel
      const streamPromises = [
        streamHtmlToBlock(LESSON_PROMPTS.title(topic), titleBlockId),
        streamHtmlToBlock(LESSON_PROMPTS.introduction(topic), introBlockId),
        streamHtmlToBlock(LESSON_PROMPTS.mainContent(topic), mainBlockId),
        streamHtmlToBlock(LESSON_PROMPTS.quizSection(topic), quizBlockId),
      ];

      // Execute all streams in parallel for maximum performance
      await Promise.all(streamPromises);

      // Final message
      addProgress(THINKING_MESSAGES.lessonComplete(title));

      return null;
    } else if (isAddBlock || force) {
      const blockId = generateBlockId();

      if (!force && lowerInput.includes('heading')) {
        addProgress(THINKING_MESSAGES.addingHeading());
        onAddBlock({ type: 'heading', content: '' }, null, blockId);

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

        await streamHtmlToBlock(BLOCK_PROMPTS.quiz(topic), blockId);

        addProgress(THINKING_MESSAGES.quizAdded());
        return null;
      } else {
        // Default to styled HTML content block
        addProgress(THINKING_MESSAGES.addingContent());

        onAddBlock({ type: 'html', content: UI_MESSAGES.loadingContent, showPreview: true }, null, blockId);

        await streamHtmlToBlock(BLOCK_PROMPTS.content(topic), blockId);

        addProgress(THINKING_MESSAGES.contentAdded());
        return null;
      }
    }

    return null;
  }, [selectedModel, onSetTitle, onSetIcon, onAddBlock, onUpdateBlock, updateThinking]);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    // Capture conversation history before modifying messages state
    const conversationHistory = [...messages];

    // Sanitize user input before processing
    const userInput = sanitizePromptInput(input);
    const displayInput = sanitizeTextInput(input);

    // Build document context from attached files
    let documentContext = '';
    const attachmentInfo = [];
    if (attachedFiles.length > 0) {
      const docParts = attachedFiles.map(file => {
        attachmentInfo.push({ type: file.type, name: file.name });
        if (file.type === 'image') {
          const canAnalyze = isVisionModel(selectedModel || '') && file.base64;
          const note = canAnalyze
            ? `[Image: ${file.name}] Ready for vision analysis.`
            : file.text;
          return `--- Document: ${file.name} ---\n${note}`;
        }

        return `--- Document: ${file.name} ---\n${file.text}`;
      });
      documentContext = '\n\n[ATTACHED DOCUMENTS]\n' + docParts.join('\n\n') + '\n[END DOCUMENTS]\n\n';
    }

    // Extract vision images (base64) for models that support them
    const visionImages = attachedFiles
      .filter(file => file.type === 'image' && file.base64)
      .map(file => file.base64);

    // Create user message with attachment badges
    const userMessage = {
      id: generateMessageId(),
      role: 'user',
      content: displayInput || 'Analyze these documents',
      attachments: attachmentInfo.length > 0 ? attachmentInfo : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    clearAttachedFiles();
    setIsLoading(true);

    // Prepend document context to user input for processing
    const fullUserInput = documentContext + (userInput || 'Please analyze the attached documents.');

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
      // FAST PATH: Direct canvas streaming for lesson creation
      // Bypasses agent JSON parsing for 3-4x faster generation
      // =========================================
      const lowerInput = userInput.toLowerCase();
      const isLessonCreation = (lowerInput.includes('create') || lowerInput.includes('make') ||
                                lowerInput.includes('write') || lowerInput.includes('generate')) &&
                               (lowerInput.includes('lesson') || lowerInput.includes('about') ||
                                lowerInput.includes('teach') || lowerInput.includes('explain'));

      if (isLessonCreation) {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
          // Extract topic from input
          const topicMatch = userInput.match(/(?:about|on|for|explaining|regarding)\s+(.+?)(?:\.|$)/i);
          const topic = topicMatch ? topicMatch[1].trim() :
            userInput.replace(/^(create|make|write|generate)\s*(a\s*)?(lesson|course|tutorial)?\s*(about|on|for)?\s*/i, '').trim();
          const title = topic.charAt(0).toUpperCase() + topic.slice(1);

          // Set title and icon immediately
          setMessages(prev => prev.map(m => m.id === thinkingId
            ? { ...m, content: '🚀 Creating lesson structure...' }
            : m
          ));
          onSetTitle(title);
          onSetIcon(getIconForTopic(topic));

          // Create all placeholder blocks instantly (progressive loading)
          const titleBlockId = generateBlockId();
          const introBlockId = generateBlockId();
          const mainBlockId = generateBlockId();
          const quizBlockId = generateBlockId();

          onAddBlock({ type: 'html', content: UI_MESSAGES.loadingTitle, showPreview: true }, null, titleBlockId);
          onAddBlock({ type: 'html', content: UI_MESSAGES.loadingIntro, showPreview: true }, null, introBlockId);
          onAddBlock({ type: 'html', content: UI_MESSAGES.loadingMain, showPreview: true }, null, mainBlockId);
          onAddBlock({ type: 'html', content: UI_MESSAGES.loadingQuiz, showPreview: true }, null, quizBlockId);

          if (signal.aborted) {
            setMessages(prev => prev.filter(m => m.id !== thinkingId));
            return;
          }

          setMessages(prev => prev.map(m => m.id === thinkingId
            ? { ...m, content: '⚡ Streaming all sections in parallel...' }
            : m
          ));

          // Stream HTML directly to blocks in parallel (FAST!)
          const streamToBlock = async (prompt, blockId) => {
            try {
              await ollamaService.chatStream(
                [{ role: 'user', content: prompt }],
                selectedModel,
                (_chunk, cumulative) => {
                  // Stream raw content immediately - show progress as it generates
                  // Try to extract HTML, but show raw content if not yet valid
                  const htmlMatch = cumulative.match(/<[^>]+>[\s\S]*/);
                  const content = htmlMatch ? htmlMatch[0] : cumulative;
                  onUpdateBlock(blockId, 'content', content);
                },
                (finalContent) => {
                  // On completion, clean up and set final HTML
                  const htmlMatch = finalContent.match(/<[^>]+>[\s\S]*<\/[^>]+>/s);
                  onUpdateBlock(blockId, 'content', htmlMatch ? htmlMatch[0] : finalContent);
                },
                signal
              );
            } catch (e) {
              if (e.name !== 'AbortError') throw e;
            }
          };

          // Execute all 4 streams in parallel
          await Promise.all([
            streamToBlock(LESSON_PROMPTS.title(topic), titleBlockId),
            streamToBlock(LESSON_PROMPTS.introduction(topic), introBlockId),
            streamToBlock(LESSON_PROMPTS.mainContent(topic), mainBlockId),
            streamToBlock(LESSON_PROMPTS.quizSection(topic), quizBlockId),
          ]);

          // Done - show completion message
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId);
            return [...filtered, {
              id: generateMessageId(),
              role: 'assistant',
              content: `✨ Created "${title}" lesson with 4 sections streaming in parallel!`,
            }];
          });

          return;
        } catch (streamError) {
          if (streamError.name === 'AbortError') {
            setMessages(prev => prev.filter(m => m.id !== thinkingId));
            return;
          }
          console.error('Stream error:', streamError);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId);
            return [...filtered, {
              id: generateMessageId(),
              role: 'assistant',
              content: `❌ Streaming error: ${streamError.message}`,
            }];
          });
          return;
        }
      }

      // =========================================
      // AGENT MODE: Use tool-based execution for other requests
      // Streams AI response in real-time while parsing tools at the end
      // =========================================
      if (useAgentMode) {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Create a streaming message that will show the response as it arrives
        const streamingMsgId = generateMessageId();

        try {
          // Run the agent with real-time streaming and conversation history
          const result = await runAgentWithTools(fullUserInput, {
            signal,
            conversationHistory,
            onStreamChunk: (accumulated) => {
              // Show the raw streaming response in real-time
              // Update the streaming message immediately with whatever we have
              setMessages(prev => {
                const existing = prev.find(m => m.id === streamingMsgId);
                if (existing) {
                  return prev.map(m => m.id === streamingMsgId
                    ? { ...m, content: accumulated }
                    : m
                  );
                } else {
                  // First chunk - replace thinking with streaming message
                  const filtered = prev.filter(m => m.id !== thinkingId);
                  return [...filtered, {
                    id: streamingMsgId,
                    role: 'assistant',
                    content: accumulated,
                    isStreaming: true
                  }];
                }
              });
            },
            onToolExecuted: (toolName) => {
              console.log('Tool executed:', toolName);
            },
          });

          // Finalize the message with tool results
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId && m.id !== streamingMsgId);
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
            setMessages(prev => prev.filter(m => m.id !== thinkingId && m.id !== streamingMsgId));
            return;
          }

          console.error('Agent error:', agentError);

          // Surface error to user instead of falling back
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId && m.id !== streamingMsgId);
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
      // LEGACY MODE: Regular text chat with streaming
      // Only used when agent mode is disabled
      // =========================================
      const useVisionStream = visionImages.length > 0 && isVisionModel(selectedModel || '');
      const legacyMessages = [
        { role: 'system', content: SYSTEM_PROMPTS.assistant },
        useVisionStream
          ? { role: 'user', content: fullUserInput, images: visionImages }
          : { role: 'user', content: fullUserInput }
      ];

      const streamFn = useVisionStream
        ? ollamaService.chatStreamWithVision.bind(ollamaService)
        : ollamaService.chatStream.bind(ollamaService);

      // Create streaming message ID
      const legacyStreamId = generateMessageId();

      await streamFn(
        legacyMessages,
        selectedModel,
        (_chunk, accumulated) => {
          // Stream content in real-time
          setMessages(prev => {
            const existing = prev.find(m => m.id === legacyStreamId);
            if (existing) {
              return prev.map(m => m.id === legacyStreamId
                ? { ...m, content: accumulated }
                : m
              );
            } else {
              // First chunk - replace thinking with streaming message
              const filtered = prev.filter(m => m.id !== thinkingId);
              return [...filtered, {
                id: legacyStreamId,
                role: 'assistant',
                content: accumulated,
                isStreaming: true
              }];
            }
          });
        },
        (finalResponse) => {
          // Finalize the message
          setMessages(prev => prev.map(m => m.id === legacyStreamId
            ? { ...m, content: finalResponse, isStreaming: false }
            : m
          ));
        }
      );

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
  }, [input, isLoading, selectedModel, attachedFiles, clearAttachedFiles, useAgentMode, runAgentWithTools, messages, onAddBlock, onSetIcon, onSetTitle, onUpdateBlock]);

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
        <div className="flex items-center gap-3">
          <img
            src="/ika.jpg"
            alt="Ika AI Agent"
            className="w-10 h-10 rounded-lg object-cover shadow-sm"
          />
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
                  <option value={import.meta.env.VITE_DEFAULT_MODEL || 'llama3.2:3b'}>
                    {import.meta.env.VITE_DEFAULT_MODEL || 'llama3.2:3b'}
                  </option>
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
                  <img src={file.preview} alt={file.name} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                    <FileText size={18} className="text-purple-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[100px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.type === 'image'
                      ? (isVisionModel(selectedModel || '') ? 'Vision image' : '⚠️ Needs vision model')
                      : file.type === 'pdf'
                        ? 'PDF'
                        : file.type === 'text'
                          ? 'Text'
                          : 'Document'}
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
            Extracting text from documents...
          </div>
        )}

        <div className="flex gap-2 items-start">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.json,.csv,.xml,.html,image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingFiles}
            className="px-3 py-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Attach file"
            title="Upload file (images need vision model)"
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
