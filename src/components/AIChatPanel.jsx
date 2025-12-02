import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Sparkles, Image, Video, FileText, Loader2, Settings, ChevronDown, Trash2, Wrench, CheckCircle, AlertCircle } from 'lucide-react';

// Tool definitions for the AI agent
const TOOLS = {
  // Context Tools
  get_lesson_info: {
    name: 'get_lesson_info',
    description: 'Get information about the current lesson including title, icon, and block count',
    parameters: {},
  },
  get_all_blocks: {
    name: 'get_all_blocks',
    description: 'Get all blocks in the lesson with their content, types, and IDs',
    parameters: {},
  },
  get_block_by_id: {
    name: 'get_block_by_id',
    description: 'Get a specific block by its ID',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the block to retrieve', required: true }
    },
  },
  search_blocks: {
    name: 'search_blocks',
    description: 'Search blocks by content or type',
    parameters: {
      query: { type: 'string', description: 'Search query to find in block content', required: false },
      type: { type: 'string', description: 'Filter by block type (text, heading, image, video, quiz)', required: false }
    },
  },

  // Block Creation Tools
  create_text_block: {
    name: 'create_text_block',
    description: 'Create a new text block with the given content',
    parameters: {
      content: { type: 'string', description: 'The text content for the block', required: true },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional, adds to end if not specified)', required: false }
    },
  },
  create_heading_block: {
    name: 'create_heading_block',
    description: 'Create a new heading block',
    parameters: {
      content: { type: 'string', description: 'The heading text', required: true },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional)', required: false }
    },
  },
  create_image_block: {
    name: 'create_image_block',
    description: 'Create a new image block with URL and optional caption',
    parameters: {
      url: { type: 'string', description: 'The image URL', required: true },
      caption: { type: 'string', description: 'Optional caption for the image', required: false },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional)', required: false }
    },
  },
  create_video_block: {
    name: 'create_video_block',
    description: 'Create a new video block with YouTube or Vimeo URL',
    parameters: {
      url: { type: 'string', description: 'The video URL (YouTube or Vimeo)', required: true },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional)', required: false }
    },
  },
  create_quiz_block: {
    name: 'create_quiz_block',
    description: 'Create a new quiz/question block with multiple choice options',
    parameters: {
      question: { type: 'string', description: 'The quiz question', required: true },
      options: { type: 'array', description: 'Array of answer options (strings)', required: true },
      correct_answer_index: { type: 'number', description: 'Index of the correct answer (0-based)', required: true },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional)', required: false }
    },
  },
  create_html_block: {
    name: 'create_html_block',
    description: 'Create a new HTML block with custom HTML content (tables, styled divs, lists, etc.)',
    parameters: {
      content: { type: 'string', description: 'The HTML content', required: true },
      after_block_id: { type: 'number', description: 'Insert after this block ID (optional)', required: false }
    },
  },

  // Block Modification Tools
  update_block_content: {
    name: 'update_block_content',
    description: 'Update the content of an existing block',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the block to update', required: true },
      content: { type: 'string', description: 'The new content', required: true }
    },
  },
  update_quiz_options: {
    name: 'update_quiz_options',
    description: 'Update quiz options and correct answer',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the quiz block', required: true },
      options: { type: 'array', description: 'New array of options', required: false },
      correct_answer_index: { type: 'number', description: 'New correct answer index', required: false }
    },
  },
  update_image_caption: {
    name: 'update_image_caption',
    description: 'Update the caption of an image block',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the image block', required: true },
      caption: { type: 'string', description: 'The new caption', required: true }
    },
  },
  delete_block: {
    name: 'delete_block',
    description: 'Delete a block by its ID',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the block to delete', required: true }
    },
  },
  move_block: {
    name: 'move_block',
    description: 'Move a block to a new position',
    parameters: {
      block_id: { type: 'number', description: 'The ID of the block to move', required: true },
      new_index: { type: 'number', description: 'The new position index (0-based)', required: true }
    },
  },

  // Lesson Metadata Tools
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
      icon: { type: 'string', description: 'The emoji icon (e.g., "📚", "🎓", "💡")', required: true }
    },
  },

  // Analysis Tools
  analyze_image: {
    name: 'analyze_image',
    description: 'Analyze an image using vision AI to get a description',
    parameters: {
      image_url: { type: 'string', description: 'The URL of the image to analyze', required: true }
    },
  },
  generate_quiz_from_content: {
    name: 'generate_quiz_from_content',
    description: 'Generate quiz questions based on the lesson content',
    parameters: {
      num_questions: { type: 'number', description: 'Number of questions to generate (1-5)', required: false }
    },
  },
};

// Generate tools description for the system prompt
const generateToolsPrompt = (lessonTitle, lessonIcon, blockCount) => {
  return `You control a lesson builder app. You MUST use tools to create content. NEVER ask questions - just create the content immediately.

RULES:
1. NEVER ask "what would you like" or "which ones" - just DO IT
2. NEVER ask for confirmation - create content immediately
3. ALWAYS use multiple tool calls to create complete lessons
4. Be proactive and creative - make decisions yourself

Current: Title="${lessonTitle || 'Untitled'}", Icon=${lessonIcon}, Blocks=${blockCount}

TOOL FORMAT - Use exactly this:
\`\`\`tool
{"tool": "tool_name", "parameters": {...}}
\`\`\`

TOOLS:
- set_lesson_title: {"title": "Title"}
- set_lesson_icon: {"icon": "🎓"}
- create_heading_block: {"content": "Heading"}
- create_text_block: {"content": "Text paragraph"}
- create_quiz_block: {"question": "Q?", "options": ["A","B","C","D"], "correct_answer_index": 0}
- create_html_block: {"content": "<div>...</div>"} - for tables, styled content, lists, code examples
- delete_block: {"block_id": 123}
- get_all_blocks: {}

EXAMPLE - User says "Create a lesson about Python":
Creating your Python lesson now!
\`\`\`tool
{"tool": "set_lesson_title", "parameters": {"title": "Learn Python Programming"}}
\`\`\`
\`\`\`tool
{"tool": "set_lesson_icon", "parameters": {"icon": "🐍"}}
\`\`\`
\`\`\`tool
{"tool": "create_heading_block", "parameters": {"content": "What is Python?"}}
\`\`\`
\`\`\`tool
{"tool": "create_text_block", "parameters": {"content": "Python is a popular programming language known for its simple syntax and versatility. It's used for web development, data science, AI, and more."}}
\`\`\`
\`\`\`tool
{"tool": "create_heading_block", "parameters": {"content": "Python Basics"}}
\`\`\`
\`\`\`tool
{"tool": "create_text_block", "parameters": {"content": "Python uses indentation to define code blocks. Variables don't need type declarations. Print statements use print() function."}}
\`\`\`
\`\`\`tool
{"tool": "create_quiz_block", "parameters": {"question": "What is Python known for?", "options": ["Complex syntax", "Simple syntax", "Only for games", "Only for websites"], "correct_answer_index": 1}}
\`\`\`

NOW: When the user asks for anything, USE THE TOOLS IMMEDIATELY. Do not ask questions. Create content now.`;
};

// Ollama API service
const ollamaService = {
  baseUrl: 'http://localhost:11434',

  async chat(messages, model = 'llama3.2') {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  },

  // Streaming chat - calls onChunk with each piece of text
  async chatStream(messages, model, onChunk, onDone) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullResponse += data.message.content;
            onChunk(data.message.content, fullResponse);
          }
          if (data.done) {
            onDone(fullResponse);
            return fullResponse;
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }

    onDone(fullResponse);
    return fullResponse;
  },

  async chatWithVision(messages, model = 'llava') {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  },

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
  },

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
};

// Tool Result Component
const ToolResult = ({ tool, result, success }) => (
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
);

// Message component
const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const isThinking = message.isThinking;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-messageIn`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-100 text-blue-600' : isThinking ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white' : 'bg-purple-100 text-purple-600'
      }`}>
        {isUser ? <User size={16} /> : isThinking ? <Sparkles size={16} className="animate-pulse" /> : <Bot size={16} />}
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isThinking
            ? 'bg-gradient-to-br from-purple-50 to-blue-50 text-gray-800 rounded-bl-md border border-purple-200'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}>
          {isThinking && (
            <div className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
              <span className="animate-pulse">●</span> AI Thinking
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Tool calls and results */}
        {message.toolCalls && message.toolCalls.map((tc, i) => (
          <ToolResult key={i} tool={tc.tool} result={tc.result} success={tc.success} />
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
      </div>
    </div>
  );
};

// Main AI Chat Panel
export default function AIChatPanel({
  isOpen,
  onClose,
  blocks,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onSetTitle,
  onSetIcon,
  lessonTitle,
  lessonIcon
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'll show my thinking here while creating interactive HTML content on your canvas. Try:\n\n• \"Create a lesson about CUDA\"\n• \"Add a table comparing languages\"\n• \"Add a code example for Python\"\n• \"Add a quiz about machine learning\"\n\nI'll generate beautiful, styled HTML blocks!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-oss:20b');
  const [visionModel, setVisionModel] = useState('llava');
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Tool execution engine
  const executeTool = async (toolName, parameters) => {
    console.log('Executing tool:', toolName, parameters);

    switch (toolName) {
      // Context Tools
      case 'get_lesson_info':
        return {
          success: true,
          result: {
            title: lessonTitle || 'Untitled',
            icon: lessonIcon,
            blockCount: blocks.length,
            blockTypes: blocks.reduce((acc, b) => {
              acc[b.type] = (acc[b.type] || 0) + 1;
              return acc;
            }, {})
          }
        };

      case 'get_all_blocks':
        return {
          success: true,
          result: blocks.map((b, i) => ({
            index: i,
            id: b.id,
            type: b.type,
            content: b.content?.slice(0, 100) + (b.content?.length > 100 ? '...' : ''),
            ...(b.type === 'quiz' && { options: b.options, correctAnswer: b.correctAnswer }),
            ...(b.type === 'image' && { caption: b.caption })
          }))
        };

      case 'get_block_by_id':
        const block = blocks.find(b => b.id === parameters.block_id);
        if (!block) return { success: false, result: 'Block not found' };
        return { success: true, result: block };

      case 'search_blocks':
        let filtered = blocks;
        if (parameters.type) {
          filtered = filtered.filter(b => b.type === parameters.type);
        }
        if (parameters.query) {
          const query = parameters.query.toLowerCase();
          filtered = filtered.filter(b =>
            b.content?.toLowerCase().includes(query) ||
            b.caption?.toLowerCase().includes(query) ||
            b.options?.some(o => o.toLowerCase().includes(query))
          );
        }
        return { success: true, result: filtered };

      // Block Creation Tools
      case 'create_text_block':
        onAddBlock({
          type: 'text',
          content: parameters.content
        }, parameters.after_block_id);
        return { success: true, result: 'Text block created' };

      case 'create_heading_block':
        onAddBlock({
          type: 'heading',
          content: parameters.content
        }, parameters.after_block_id);
        return { success: true, result: 'Heading block created' };

      case 'create_image_block':
        onAddBlock({
          type: 'image',
          content: parameters.url,
          caption: parameters.caption || ''
        }, parameters.after_block_id);
        return { success: true, result: 'Image block created' };

      case 'create_video_block':
        onAddBlock({
          type: 'video',
          content: parameters.url
        }, parameters.after_block_id);
        return { success: true, result: 'Video block created' };

      case 'create_quiz_block':
        onAddBlock({
          type: 'quiz',
          content: parameters.question,
          options: parameters.options,
          correctAnswer: parameters.correct_answer_index
        }, parameters.after_block_id);
        return { success: true, result: 'Quiz block created' };

      case 'create_html_block':
        onAddBlock({
          type: 'html',
          content: parameters.content,
          showPreview: true
        }, parameters.after_block_id);
        return { success: true, result: 'HTML block created' };

      // Block Modification Tools
      case 'update_block_content':
        const blockToUpdate = blocks.find(b => b.id === parameters.block_id);
        if (!blockToUpdate) return { success: false, result: 'Block not found' };
        onUpdateBlock(parameters.block_id, 'content', parameters.content);
        return { success: true, result: 'Block content updated' };

      case 'update_quiz_options':
        const quizBlock = blocks.find(b => b.id === parameters.block_id);
        if (!quizBlock || quizBlock.type !== 'quiz') {
          return { success: false, result: 'Quiz block not found' };
        }
        if (parameters.options) {
          onUpdateBlock(parameters.block_id, 'options', parameters.options);
        }
        if (parameters.correct_answer_index !== undefined) {
          onUpdateBlock(parameters.block_id, 'correctAnswer', parameters.correct_answer_index);
        }
        return { success: true, result: 'Quiz options updated' };

      case 'update_image_caption':
        const imgBlock = blocks.find(b => b.id === parameters.block_id);
        if (!imgBlock || imgBlock.type !== 'image') {
          return { success: false, result: 'Image block not found' };
        }
        onUpdateBlock(parameters.block_id, 'caption', parameters.caption);
        return { success: true, result: 'Image caption updated' };

      case 'delete_block':
        if (blocks.length <= 1) {
          return { success: false, result: 'Cannot delete the last block' };
        }
        const blockExists = blocks.find(b => b.id === parameters.block_id);
        if (!blockExists) return { success: false, result: 'Block not found' };
        onDeleteBlock(parameters.block_id);
        return { success: true, result: 'Block deleted' };

      case 'move_block':
        if (parameters.new_index < 0 || parameters.new_index >= blocks.length) {
          return { success: false, result: 'Invalid position' };
        }
        onMoveBlock(parameters.block_id, parameters.new_index);
        return { success: true, result: `Block moved to position ${parameters.new_index}` };

      // Lesson Metadata Tools
      case 'set_lesson_title':
        onSetTitle(parameters.title);
        return { success: true, result: `Title set to "${parameters.title}"` };

      case 'set_lesson_icon':
        onSetIcon(parameters.icon);
        return { success: true, result: `Icon set to ${parameters.icon}` };

      // Analysis Tools
      case 'analyze_image':
        try {
          const base64 = await ollamaService.imageUrlToBase64(parameters.image_url);
          if (!base64) throw new Error('Could not load image');

          const analysis = await ollamaService.chatWithVision([
            { role: 'system', content: 'Describe this image in detail. Suggest how it could be used in an educational lesson and propose a caption.' },
            { role: 'user', content: 'Analyze this image:', images: [base64] }
          ], visionModel);

          return { success: true, result: analysis };
        } catch (error) {
          return { success: false, result: `Image analysis failed: ${error.message}` };
        }

      case 'generate_quiz_from_content':
        const numQuestions = Math.min(parameters.num_questions || 1, 5);
        const contentSummary = blocks
          .filter(b => b.type === 'text' || b.type === 'heading')
          .map(b => b.content)
          .join('\n')
          .slice(0, 2000);

        if (!contentSummary.trim()) {
          return { success: false, result: 'No text content found to generate quiz from' };
        }

        // This will be handled by the main chat flow
        return {
          success: true,
          result: `Content summary for quiz generation (${numQuestions} questions requested):\n${contentSummary}`,
          needsFollowUp: true
        };

      default:
        return { success: false, result: `Unknown tool: ${toolName}` };
    }
  };

  // Parse and execute tool calls from AI response
  const parseAndExecuteTools = async (response) => {
    const toolCalls = [];

    // Try multiple patterns to catch tool calls
    const patterns = [
      /```tool\s*\n?([\s\S]*?)\n?```/g,           // ```tool ... ```
      /```json\s*\n?([\s\S]*?)\n?```/g,           // ```json ... ```
      /```\s*\n?(\{[^`]*"tool"[^`]*\})\n?```/g,   // ``` {"tool":...} ```
      /\{["\s]*tool["\s]*:["\s]*[^}]+\}/g,        // raw {"tool": ...} anywhere
    ];

    let processedResponse = response;

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex

      while ((match = pattern.exec(response)) !== null) {
        try {
          // Get the JSON part
          let jsonStr = match[1] || match[0];
          jsonStr = jsonStr.trim();

          // Try to parse it
          const toolCall = JSON.parse(jsonStr);

          if (toolCall.tool) {
            console.log('Found tool call:', toolCall);
            const result = await executeTool(toolCall.tool, toolCall.parameters || {});
            toolCalls.push({
              tool: toolCall.tool,
              parameters: toolCall.parameters,
              ...result
            });
            // Remove this match from response
            processedResponse = processedResponse.replace(match[0], '');
          }
        } catch (e) {
          console.log('Failed to parse:', match[0], e.message);
        }
      }
    }

    // Clean up the response
    const cleanedResponse = processedResponse
      .replace(/```[a-z]*\s*```/g, '') // Remove empty code blocks
      .replace(/\n{3,}/g, '\n\n')       // Remove excessive newlines
      .trim();

    console.log('Tool calls found:', toolCalls.length);
    console.log('Cleaned response:', cleanedResponse);

    return { toolCalls, cleanedResponse };
  };

  // Check Ollama connection and fetch models
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const modelList = await ollamaService.getModels();
        if (modelList.length > 0) {
          setModels(modelList);
          setConnectionStatus('connected');
          const hasLlama = modelList.some(m => m.name.includes('llama'));
          const hasVision = modelList.some(m => m.name.includes('llava') || m.name.includes('bakllava'));
          if (hasLlama) {
            const llamaModel = modelList.find(m => m.name.includes('llama'));
            setSelectedModel(llamaModel?.name || 'llama3.2');
          }
          if (hasVision) {
            const vModel = modelList.find(m => m.name.includes('llava') || m.name.includes('bakllava'));
            setVisionModel(vModel?.name || 'llava');
          }
        } else {
          setConnectionStatus('no_models');
        }
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };

    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Helper to wait for React state update
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Update thinking message in chat
  const updateThinking = (text) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isThinking) {
        lastMsg.content = text;
      }
      return [...newMessages];
    });
  };

  // Add thinking message
  const addThinking = (text) => {
    setMessages(prev => [...prev, { role: 'assistant', content: text, isThinking: true }]);
  };

  // Stream content directly to canvas with thinking in chat
  const streamToCanvas = async (userInput) => {
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
      addThinking(`🎯 **Planning lesson: "${title}"**\n\n⏳ Analyzing topic and structure...`);
      await wait(100);

      // Set title and icon
      updateThinking(`🎯 **Planning lesson: "${title}"**\n\n✓ Setting lesson title\n⏳ Choosing icon...`);
      onSetTitle(title);

      const icons = { 'python': '🐍', 'cuda': '🖥️', 'gpu': '🖥️', 'ai': '🤖', 'machine': '🤖', 'neural': '🧠', 'deep': '🧠', 'space': '🚀', 'science': '🔬', 'math': '📐', 'history': '📜', 'language': '📝', 'music': '🎵', 'art': '🎨', 'code': '💻', 'programming': '💻', 'web': '🌐', 'data': '📊' };
      const iconKey = Object.keys(icons).find(k => topic.toLowerCase().includes(k));
      onSetIcon(iconKey ? icons[iconKey] : '📚');

      // STEP 1: Create Title Block
      updateThinking(`🎯 **Planning lesson: "${title}"**\n\n✓ Setting lesson title\n✓ Icon set: ${iconKey ? icons[iconKey] : '📚'}\n\n📝 **Step 1/4:** Creating title section...`);

      const titleBlockId = Date.now();
      onAddBlock({ type: 'html', content: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating title...</div>', showPreview: true }, null, titleBlockId);
      await wait(50);

      const titleHtml = await ollamaService.chat(
        [{ role: 'user', content: `Create an HTML title/header section for a lesson about: ${topic}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- Large title with the topic name
- Gradient background (use #667eea to #764ba2 or similar)
- White text on the gradient
- Brief tagline or subtitle (1 line)
- Rounded corners, padding
- Professional and modern look

Example format:
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 16px; text-align: center;">
  <h1 style="color: white; font-size: 2.5em; margin: 0;">Topic Title</h1>
  <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Brief description</p>
</div>` }],
        selectedModel
      );

      let titleContent = titleHtml;
      const titleMatch = titleHtml.match(/<div[\s\S]*<\/div>/i);
      if (titleMatch) titleContent = titleMatch[0];
      onUpdateBlock(titleBlockId, 'content', titleContent);

      // STEP 2: Introduction & Learning Objectives
      updateThinking(`🎯 **Planning lesson: "${title}"**\n\n✓ Title section created\n\n📝 **Step 2/4:** Writing introduction & objectives...`);

      const introBlockId = Date.now() + 100;
      onAddBlock({ type: 'html', content: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating introduction...</div>', showPreview: true }, null, introBlockId);
      await wait(50);

      const introHtml = await ollamaService.chat(
        [{ role: 'user', content: `Create an HTML introduction section for a lesson about: ${topic}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- A "📖 Introduction" heading
- 2-3 sentences introducing the topic
- A "🎯 Learning Objectives" section with 3-4 bullet points
- Use a clean card design with light background (#f8fafc)
- Border radius, subtle border
- Good typography and spacing

Make it informative and engaging.` }],
        selectedModel
      );

      let introContent = introHtml;
      const introMatch = introHtml.match(/<div[\s\S]*<\/div>/i);
      if (introMatch) introContent = introMatch[0];
      onUpdateBlock(introBlockId, 'content', introContent);

      // STEP 3: Main Content
      updateThinking(`🎯 **Planning lesson: "${title}"**\n\n✓ Title section created\n✓ Introduction written\n\n📝 **Step 3/4:** Generating main content...`);

      const mainBlockId = Date.now() + 200;
      onAddBlock({ type: 'html', content: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating main content...</div>', showPreview: true }, null, mainBlockId);
      await wait(50);

      const mainHtml = await ollamaService.chat(
        [{ role: 'user', content: `Create the main educational content HTML for a lesson about: ${topic}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- 2-3 main sections with clear headings (use h2 or h3)
- Each section explains a key concept
- Use info boxes with colored left borders for important points
- Include emoji icons for visual appeal
- Code examples if relevant (dark background #1e293b, light text)
- Tips in green boxes, warnings in amber boxes
- Good spacing between sections

Colors to use:
- Blue (#3b82f6) for primary accents
- Green (#10b981) for tips/success
- Amber (#f59e0b) for warnings
- Purple (#8b5cf6) for highlights` }],
        selectedModel
      );

      let mainContent = mainHtml;
      const mainMatch = mainHtml.match(/<div[\s\S]*<\/div>/i);
      if (mainMatch) mainContent = mainMatch[0];
      onUpdateBlock(mainBlockId, 'content', mainContent);

      // STEP 4: Quiz
      updateThinking(`🎯 **Planning lesson: "${title}"**\n\n✓ Title section created\n✓ Introduction written\n✓ Main content generated\n\n📝 **Step 4/4:** Creating quiz questions...`);

      const quizBlockId = Date.now() + 300;
      onAddBlock({ type: 'html', content: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating quiz...</div>', showPreview: true }, null, quizBlockId);
      await wait(50);

      const quizHtml = await ollamaService.chat(
        [{ role: 'user', content: `Create an HTML quiz section for a lesson about: ${topic}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- "🧠 Check Your Understanding" header
- 2-3 multiple choice questions
- Each question in a card with light blue background (#eff6ff)
- 4 options per question (A, B, C, D)
- Options styled as clickable-looking labels
- Question numbers clearly shown
- Clean, professional quiz layout

Structure:
<div style="...container...">
  <h2>🧠 Check Your Understanding</h2>
  <div style="...question card...">
    <p><strong>Question 1:</strong> ...</p>
    <div style="...options...">
      <div style="...option...">A) ...</div>
      ...
    </div>
  </div>
  ...more questions...
</div>` }],
        selectedModel
      );

      let quizContent = quizHtml;
      const quizMatch = quizHtml.match(/<div[\s\S]*<\/div>/i);
      if (quizMatch) quizContent = quizMatch[0];
      onUpdateBlock(quizBlockId, 'content', quizContent);

      // Final message
      updateThinking(`✅ **Lesson Complete!**\n\n📚 **"${title}"**\n\n✓ Title section\n✓ Introduction & objectives\n✓ Main content (key concepts)\n✓ Quiz questions\n\n👀 Check the canvas to see your lesson!`);

      return null;
    } else if (isAddBlock) {
      const blockId = Date.now();

      if (lowerInput.includes('heading')) {
        addThinking(`📝 **Adding heading**\n\nTopic: "${topic}"\n⏳ Generating...`);
        onAddBlock({ type: 'heading', content: '' }, null, blockId);
        await wait(50);
        await ollamaService.chatStream(
          [{ role: 'user', content: `Write a short heading (3-6 words) about: ${topic}. Just the heading text, nothing else.` }],
          selectedModel,
          (chunk, full) => onUpdateBlock(blockId, 'content', full.trim()),
          () => {}
        );
        updateThinking(`✅ **Heading added!**\n\nTopic: "${topic}"\n\n👀 Check the canvas`);
        return null;
      } else if (lowerInput.includes('html') || lowerInput.includes('table') || lowerInput.includes('code') || lowerInput.includes('list') || lowerInput.includes('card') || lowerInput.includes('box')) {
        const htmlType = lowerInput.includes('table') ? 'table' :
                        lowerInput.includes('code') ? 'code example' :
                        lowerInput.includes('list') ? 'list' :
                        lowerInput.includes('card') ? 'info card' :
                        lowerInput.includes('box') ? 'content box' : 'HTML block';

        addThinking(`🎨 **Adding ${htmlType}**\n\nTopic: "${topic}"\n⏳ Generating HTML...`);

        onAddBlock({ type: 'html', content: `<div style="padding: 20px; text-align: center; color: #888;">⏳ Generating ${htmlType}...</div>`, showPreview: true }, null, blockId);
        await wait(50);

        const htmlResponse = await ollamaService.chat(
          [{ role: 'user', content: `Create a ${htmlType} in HTML about: ${topic || 'the topic'}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- Use clean, semantic HTML with inline styles
- Make it visually professional
- Use colors: #3b82f6 (blue), #10b981 (green), #f59e0b (amber), #8b5cf6 (purple)
- Add shadows, rounded corners where appropriate

${lowerInput.includes('table') ? `Create a comparison/data table:
- Header row with gradient background (#667eea to #764ba2)
- White header text
- Alternating row colors (#f8fafc and white)
- Border radius on container
- Proper cell padding` : ''}
${lowerInput.includes('code') ? `Create a code example:
- Header bar showing language name
- Dark background (#1e293b)
- Colored syntax (strings in green, keywords in purple, etc.)
- Monospace font
- Border radius` : ''}
${lowerInput.includes('list') ? `Create a styled list:
- Each item as a mini-card
- Colored number/bullet indicators
- Good spacing
- Maybe icons or emoji` : ''}
${lowerInput.includes('card') || lowerInput.includes('box') ? `Create an info card:
- Shadow and rounded corners
- Colored left border or header
- Icon in header
- Well-formatted content` : ''}` }],
          selectedModel
        );

        let htmlContent = htmlResponse;
        const htmlMatch = htmlResponse.match(/<[^>]+[\s\S]*<\/[^>]+>/);
        if (htmlMatch) {
          htmlContent = htmlMatch[0];
        }

        onUpdateBlock(blockId, 'content', htmlContent);
        updateThinking(`✅ **${htmlType.charAt(0).toUpperCase() + htmlType.slice(1)} added!**\n\nTopic: "${topic}"\n\n👀 Check the canvas`);
        return null;
      } else if (lowerInput.includes('quiz')) {
        addThinking(`❓ **Adding quiz**\n\nTopic: "${topic}"\n⏳ Generating questions...`);

        onAddBlock({ type: 'html', content: '<div style="padding: 20px; text-align: center; color: #888;">⏳ Generating quiz...</div>', showPreview: true }, null, blockId);
        await wait(50);

        const quizHtml = await ollamaService.chat(
          [{ role: 'user', content: `Create an HTML quiz about: ${topic || 'general knowledge'}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- 2 multiple choice questions
- Each question in a card (light blue background #eff6ff)
- 4 options per question (A, B, C, D)
- Options as styled labels with hover effect look
- Numbered questions
- Professional quiz design` }],
          selectedModel
        );

        let quizContent = quizHtml;
        const quizMatch = quizHtml.match(/<div[\s\S]*<\/div>/i);
        if (quizMatch) quizContent = quizMatch[0];
        onUpdateBlock(blockId, 'content', quizContent);

        updateThinking(`✅ **Quiz added!**\n\nTopic: "${topic}"\n\n👀 Check the canvas`);
        return null;
      } else {
        // Default to styled HTML content block
        addThinking(`📝 **Adding content block**\n\nTopic: "${topic}"\n⏳ Writing...`);

        onAddBlock({ type: 'html', content: '<div style="padding: 20px; text-align: center; color: #888;">⏳ Writing content...</div>', showPreview: true }, null, blockId);
        await wait(50);

        const textHtml = await ollamaService.chat(
          [{ role: 'user', content: `Create an HTML content block about: ${topic}

IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.

Requirements:
- 3-4 informative sentences about the topic
- Clean card design with subtle background (#f8fafc)
- Border radius, nice padding
- Good typography
- Maybe a small heading or emoji icon` }],
          selectedModel
        );

        let textContent = textHtml;
        const textMatch = textHtml.match(/<[^>]+[\s\S]*<\/[^>]+>/);
        if (textMatch) textContent = textMatch[0];
        onUpdateBlock(blockId, 'content', textContent);

        updateThinking(`✅ **Content added!**\n\nTopic: "${topic}"\n\n👀 Check the canvas`);
        return null;
      }
    }

    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Check if it's a creation/add request
      const lowerInput = userInput.toLowerCase();
      const isCreationRequest =
        lowerInput.includes('create') ||
        lowerInput.includes('make') ||
        lowerInput.includes('write') ||
        lowerInput.includes('generate') ||
        lowerInput.includes('add') ||
        lowerInput.includes('insert');

      if (isCreationRequest) {
        // Use streaming to canvas with thinking in chat
        await streamToCanvas(userInput);
      } else {
        // Regular chat for questions/other requests
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '💭 Thinking...',
          isThinking: true
        }]);

        const response = await ollamaService.chat([
          { role: 'system', content: `You are a helpful AI assistant for a lesson builder app.
You help users create educational content. Be concise and helpful.
If the user wants to create content, suggest they use commands like:
- "Create a lesson about [topic]"
- "Add a table about [topic]"
- "Add a code example for [topic]"
- "Add a quiz about [topic]"` },
          { role: 'user', content: userInput }
        ], selectedModel);

        // Replace thinking message with actual response
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx]?.isThinking) {
            newMessages[lastIdx] = {
              role: 'assistant',
              content: response
            };
          } else {
            newMessages.push({
              role: 'assistant',
              content: response
            });
          }
          return newMessages;
        });
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        // Remove thinking message if exists and add error
        const filtered = prev.filter(m => !m.isThinking);
        return [...filtered, {
          role: 'assistant',
          content: `❌ Error: ${error.message}\n\nMake sure Ollama is running on localhost:11434.`
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (imageUrl) => {
    if (isLoading) return;
    setInput(`Analyze this image and suggest a caption: ${imageUrl}`);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared. What would you like me to create?"
    }]);
  };

  const quickActions = [
    { label: 'Create lesson', prompt: 'Create a complete lesson about an interesting science topic' },
    { label: 'Add quiz', prompt: 'Add a quiz block with 4 options' },
    { label: 'Add table', prompt: 'Add a table about programming languages comparison' },
    { label: 'Add code', prompt: 'Add a code example block' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col animate-slideIn">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-1">
              AI Agent
              <Wrench size={12} className="text-purple-500" />
            </h3>
            <p className="text-xs text-gray-500">
              {connectionStatus === 'connected' ? (
                <span className="text-green-600">Connected • {selectedModel}</span>
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
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Chat Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
              {models.length === 0 && <option value="gpt-oss:20b">gpt-oss:20b (default)</option>}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Vision Model</label>
            <select
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {models.filter(m => m.name.includes('llava') || m.name.includes('bakllava') || m.name.includes('vision')).map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
              {models.length === 0 && <option value="llava">llava (default)</option>}
            </select>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              <strong>Available tools:</strong> {Object.keys(TOOLS).length} tools for creating, editing, and managing lesson content.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => {
              setInput(action.prompt);
              inputRef.current?.focus();
            }}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium whitespace-nowrap hover:bg-gray-200 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Analyze Images from Lesson */}
      {blocks.some(b => b.type === 'image' && b.content) && (
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">Analyze lesson images:</p>
          <div className="flex gap-2 overflow-x-auto">
            {blocks.filter(b => b.type === 'image' && b.content).map((block, i) => (
              <button
                key={block.id}
                onClick={() => handleAnalyzeImage(block.content)}
                disabled={isLoading}
                className="relative group"
              >
                <img
                  src={block.content}
                  alt={`Image ${i + 1}`}
                  className="w-12 h-12 object-cover rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                />
                <div className="absolute inset-0 bg-purple-600/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, i) => (
          <ChatMessage key={i} message={message} />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-purple-500" />
              <span className="text-sm text-gray-500">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create, edit, or analyze..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          {Object.keys(TOOLS).length} tools available • Powered by Ollama
        </p>
      </div>
    </div>
  );
}
