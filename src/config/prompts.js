// AI Agent Prompts Configuration
// All prompts used by the AI chat panel are defined here for easy customization

import { AGENT, buildAgentSystemPrompt, IKA_MESSAGES } from './agent';

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

export const SYSTEM_PROMPTS = {
  // Main chat assistant - canvas-action-oriented
  assistant: buildAgentSystemPrompt(),

  // Vision-enabled assistant (when looking at canvas)
  visionAssistant: buildAgentSystemPrompt(`You can SEE the lesson canvas right now.
The first image is your current view. Analyze it and take action based on what you see.`),

  // Image analysis
  imageAnalysis: `You are ${AGENT.name} ${AGENT.avatar}. Briefly describe this image and suggest how to use it in the lesson. Keep it under 3 sentences.`,
};

// =============================================================================
// WELCOME & UI MESSAGES
// =============================================================================

export const UI_MESSAGES = {
  welcome: IKA_MESSAGES.welcome,
  chatCleared: IKA_MESSAGES.chatCleared,

  // Loading placeholders
  loadingTitle: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating title...</div>',
  loadingIntro: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating introduction...</div>',
  loadingMain: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating main content...</div>',
  loadingQuiz: '<div style="padding:20px;text-align:center;color:#888;">⏳ Generating quiz...</div>',
  loadingContent: '<div style="padding: 20px; text-align: center; color: #888;">⏳ Writing content...</div>',
  loadingBlock: (type) => `<div style="padding: 20px; text-align: center; color: #888;">⏳ Generating ${type}...</div>`,
};

// =============================================================================
// CONTENT GENERATION PROMPTS
// =============================================================================

// Common instruction that's prepended to all generation prompts
const HTML_ONLY_INSTRUCTION = `IMPORTANT: Return ONLY raw HTML code. No markdown, no \`\`\`, no explanation.`;

// Color palette used across prompts
export const COLOR_PALETTE = {
  primary: '#3b82f6',      // blue
  success: '#10b981',      // green
  warning: '#f59e0b',      // amber
  highlight: '#8b5cf6',    // purple
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  background: '#f8fafc',
  codeBackground: '#1e293b',
  quizBackground: '#eff6ff',
};

export const LESSON_PROMPTS = {
  // Title/Header section for full lesson
  title: (topic) => `Create an HTML title/header section for a lesson about: ${topic}

${HTML_ONLY_INSTRUCTION}

Requirements:
- Large title with the topic name
- Gradient background (use ${COLOR_PALETTE.gradientStart} to ${COLOR_PALETTE.gradientEnd} or similar)
- White text on the gradient
- Brief tagline or subtitle (1 line)
- Rounded corners, padding
- Professional and modern look

Example format:
<div style="background: linear-gradient(135deg, ${COLOR_PALETTE.gradientStart} 0%, ${COLOR_PALETTE.gradientEnd} 100%); padding: 40px; border-radius: 16px; text-align: center;">
  <h1 style="color: white; font-size: 2.5em; margin: 0;">Topic Title</h1>
  <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Brief description</p>
</div>`,

  // Introduction & Learning Objectives section
  introduction: (topic) => `Create an HTML introduction section for a lesson about: ${topic}

${HTML_ONLY_INSTRUCTION}

Requirements:
- A "📖 Introduction" heading
- 2-3 sentences introducing the topic
- A "🎯 Learning Objectives" section with 3-4 bullet points
- Use a clean card design with light background (${COLOR_PALETTE.background})
- Border radius, subtle border
- Good typography and spacing

Make it informative and engaging.`,

  // Main content section
  mainContent: (topic) => `Create the main educational content HTML for a lesson about: ${topic}

${HTML_ONLY_INSTRUCTION}

Requirements:
- 2-3 main sections with clear headings (use h2 or h3)
- Each section explains a key concept
- Use info boxes with colored left borders for important points
- Include emoji icons for visual appeal
- Code examples if relevant (dark background ${COLOR_PALETTE.codeBackground}, light text)
- Tips in green boxes, warnings in amber boxes
- Good spacing between sections

Colors to use:
- Blue (${COLOR_PALETTE.primary}) for primary accents
- Green (${COLOR_PALETTE.success}) for tips/success
- Amber (${COLOR_PALETTE.warning}) for warnings
- Purple (${COLOR_PALETTE.highlight}) for highlights`,

  // Quiz section for full lesson
  quizSection: (topic) => `Create an HTML quiz section for a lesson about: ${topic}

${HTML_ONLY_INSTRUCTION}

Requirements:
- "🧠 Check Your Understanding" header
- 2-3 multiple choice questions
- Each question in a card with light blue background (${COLOR_PALETTE.quizBackground})
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
</div>`,
};

// =============================================================================
// BLOCK GENERATION PROMPTS
// =============================================================================

export const BLOCK_PROMPTS = {
  // Simple heading
  heading: (topic) => `Write a short heading (3-6 words) about: ${topic}. Just the heading text, nothing else.`,

  // Generic HTML block base prompt
  htmlBase: (type, topic) => `Create a ${type} in HTML about: ${topic || 'the topic'}

${HTML_ONLY_INSTRUCTION}

Requirements:
- Use clean, semantic HTML with inline styles
- Make it visually professional
- Use colors: ${COLOR_PALETTE.primary} (blue), ${COLOR_PALETTE.success} (green), ${COLOR_PALETTE.warning} (amber), ${COLOR_PALETTE.highlight} (purple)
- Add shadows, rounded corners where appropriate`,

  // Table-specific additions
  table: `Create a comparison/data table:
- Header row with gradient background (${COLOR_PALETTE.gradientStart} to ${COLOR_PALETTE.gradientEnd})
- White header text
- Alternating row colors (${COLOR_PALETTE.background} and white)
- Border radius on container
- Proper cell padding`,

  // Code example additions
  code: `Create a code example:
- Header bar showing language name
- Dark background (${COLOR_PALETTE.codeBackground})
- Colored syntax (strings in green, keywords in purple, etc.)
- Monospace font
- Border radius`,

  // List additions
  list: `Create a styled list:
- Each item as a mini-card
- Colored number/bullet indicators
- Good spacing
- Maybe icons or emoji`,

  // Card/box additions
  card: `Create an info card:
- Shadow and rounded corners
- Colored left border or header
- Icon in header
- Well-formatted content`,

  // Standalone quiz block
  quiz: (topic) => `Create an HTML quiz about: ${topic || 'general knowledge'}

${HTML_ONLY_INSTRUCTION}

Requirements:
- 2 multiple choice questions
- Each question in a card (light blue background ${COLOR_PALETTE.quizBackground})
- 4 options per question (A, B, C, D)
- Options as styled labels with hover effect look
- Numbered questions
- Professional quiz design`,

  // Default content block
  content: (topic) => `Create an HTML content block about: ${topic}

${HTML_ONLY_INSTRUCTION}

Requirements:
- 3-4 informative sentences about the topic
- Clean card design with subtle background (${COLOR_PALETTE.background})
- Border radius, nice padding
- Good typography
- Maybe a small heading or emoji icon`,
};

// =============================================================================
// BRIEF STATUS MESSAGES (shown in chat while canvas updates)
// =============================================================================

export const THINKING_MESSAGES = {
  // Lesson creation - brief acknowledgments
  lessonPlanning: (title) => `Creating "${title}"...`,
  lessonSetTitle: (title) => `Setting up "${title}"...`,
  lessonStep1: () => `Adding title section...`,
  lessonStep2: () => `Adding introduction...`,
  lessonStep3: () => `Adding main content...`,
  lessonStep4: () => `Adding quiz...`,
  lessonComplete: (title) => `Done! "${title}" is ready.`,

  // Block creation - brief
  addingHeading: () => `Adding heading...`,
  addingHtml: (type) => `Adding ${type}...`,
  addingQuiz: () => `Adding quiz...`,
  addingContent: () => `Adding content...`,

  // Completion - brief
  headingAdded: () => `Heading added.`,
  htmlAdded: (type) => `${type.charAt(0).toUpperCase() + type.slice(1)} added.`,
  quizAdded: () => `Quiz added.`,
  contentAdded: () => `Content added.`,
};

// =============================================================================
// ICON MAPPING FOR LESSONS
// =============================================================================

export const TOPIC_ICONS = {
  'python': '🐍',
  'cuda': '🖥️',
  'gpu': '🖥️',
  'ai': '🤖',
  'machine': '🤖',
  'neural': '🧠',
  'deep': '🧠',
  'space': '🚀',
  'science': '🔬',
  'math': '📐',
  'history': '📜',
  'language': '📝',
  'music': '🎵',
  'art': '🎨',
  'code': '💻',
  'programming': '💻',
  'web': '🌐',
  'data': '📊',
};

export const DEFAULT_ICON = '📚';

// Helper function to get icon for a topic
export function getIconForTopic(topic) {
  const lowerTopic = topic.toLowerCase();
  const matchedKey = Object.keys(TOPIC_ICONS).find(key => lowerTopic.includes(key));
  return matchedKey ? TOPIC_ICONS[matchedKey] : DEFAULT_ICON;
}

// =============================================================================
// QUICK ACTIONS
// =============================================================================

export const QUICK_ACTIONS = [
  { label: 'Create lesson', prompt: 'Create a complete lesson about an interesting science topic' },
  { label: 'Add quiz', prompt: 'Add a quiz block with 4 options' },
  { label: 'Add table', prompt: 'Add a table about programming languages comparison' },
  { label: 'Add code', prompt: 'Add a code example block' },
];

// =============================================================================
// RE-EXPORT AGENT CONFIG
// =============================================================================

export { AGENT, IKA_MESSAGES } from './agent';
