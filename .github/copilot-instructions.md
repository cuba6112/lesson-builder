# Lesson Builder - AI Coding Guidelines

## Architecture Overview

This is a **Notion-style lesson builder** with an integrated AI agent (Ika 🦑) that creates educational content. It runs as both a web app (Vite) and a desktop app (Tauri).

### Core Data Flow
```
User Input → AIChatPanel → Ollama Service → Tool Execution → Canvas Update
                ↓
         LessonBuilder (canvas) ← blocks state ← App (persistence)
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `App.jsx` | Root state management, lesson persistence via localStorage | `src/App.jsx` |
| `LessonBuilder.jsx` | Canvas rendering, block CRUD, drag-drop via @dnd-kit | `src/components/LessonBuilder.jsx` |
| `AIChatPanel.jsx` | AI agent with tool-calling, streaming responses | `src/components/AIChatPanel.jsx` |
| `ollama.js` | Ollama API client with streaming, vision support | `src/services/ollama.js` |
| `agent.js` | Ika agent personality, gamification system | `src/config/agent.js` |
| `prompts.js` | All AI prompts, color palette, block templates | `src/config/prompts.js` |

### Block System
Blocks are the atomic content units. Each has `id`, `type`, and type-specific fields:
- **Standard blocks**: `text`, `heading`, `image`, `video`, `quiz`, `html`, `code`
- **Interactive blocks**: `react` (live React via react-live), `mermaid` (diagrams), `math` (LaTeX via KaTeX)

Block IDs use `generateBlockId()` from `src/utils/ids.js` - always use this, never hardcode IDs.

## AI Agent System

### Tool-Calling Architecture
The AI uses a JSON-based tool system (see `TOOLS` object in `AIChatPanel.jsx`):

```javascript
// AI returns structured JSON:
{
  "thought": "reasoning",
  "tool_calls": [{ "tool": "create_block", "params": { "content": "<html>" } }],
  "message": "brief user message"
}
```

**Available tools**: `set_lesson_title`, `set_lesson_icon`, `create_block`, `update_block`, `delete_block`, `create_code_block`, `create_react_block`, `create_mermaid_block`, `create_math_block`, `stream_html_block`

### Fast Path Optimization
Lesson creation bypasses JSON parsing for 3-4x speed - look for `isLessonCreation` check in `handleSend()`. It streams 4 blocks in parallel directly to canvas.

### Prompts Configuration
All prompts live in `src/config/prompts.js`. The color palette is defined there:
```javascript
COLOR_PALETTE = {
  primary: '#3b82f6',      // blue
  success: '#10b981',      // green
  warning: '#f59e0b',      // amber
  highlight: '#8b5cf6',    // purple
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
}
```

## Development Commands

```bash
npm run dev          # Start Vite dev server (web)
npm run tauri:dev    # Start Tauri desktop app with hot reload
npm run build        # Production build (web)
npm run tauri:build  # Production desktop app
npm run lint         # ESLint check
```

**Ollama requirement**: The app expects Ollama running at `http://localhost:11434`. Configure via `VITE_OLLAMA_URL` env var or `VITE_DEFAULT_MODEL` for default model.

## Code Conventions

### State Management
- App-level state in `App.jsx` using `useState` with debounced localStorage persistence
- Component state for UI-only concerns (menus, editing modes)
- Chat history persisted per-lesson via `storage.js` functions

### HTML Content Generation
All AI-generated HTML uses inline styles (no external CSS). When creating HTML blocks:
- Use the `COLOR_PALETTE` colors
- Include gradients for headers: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`
- Add `border-radius`, `box-shadow` for modern look
- Sanitize with DOMPurify before rendering

### React Component Pattern
```jsx
// Always use memo for block components
const Component = memo(({ prop }) => { ... });
Component.displayName = 'Component';

// Use useCallback for handlers passed to children
const handleAction = useCallback(() => { ... }, [deps]);
```

### Error Handling
- Wrap risky renders in `<ErrorBoundary>` (see `src/components/ErrorBoundary.jsx`)
- Ollama errors use typed errors: `OllamaConnectionError`, `OllamaModelError`
- User-facing errors should be brief and actionable

## File Organization

```
src/
├── components/     # React components (one per file)
├── config/         # agent.js (personality), prompts.js (all prompts)
├── services/       # ollama.js, storage.js, export.js
└── utils/          # ids.js, sanitize.js
```

## Testing Changes

1. **AI features**: Test with "Create a lesson about [topic]" - should stream 4 blocks in parallel
2. **Block editing**: Use `/` slash commands in empty text blocks
3. **Export**: Test PDF (uses html2pdf.js lazy-loaded), Markdown, and JSON exports
4. **Tauri**: Run `npm run tauri:dev` to verify desktop-specific behavior

## Common Tasks

### Adding a New Block Type
1. Add type to `SlashCommandMenu` in `LessonBuilder.jsx`
2. Add render case in `Block.renderBlockContent()` and preview in `renderPreview()`
3. Add tool in `AIChatPanel.jsx` TOOLS object if AI should create it
4. Add export handling in `src/services/export.js`

### Modifying AI Behavior
- Agent personality: `src/config/agent.js` (BEHAVIORAL_RULES, REWARD_SYSTEM)
- Prompts: `src/config/prompts.js` (LESSON_PROMPTS, BLOCK_PROMPTS)
- Tool execution: `executeTool()` function in `AIChatPanel.jsx`

### Adding Vision/Image Features
Vision models (llava, qwen3-vl) are detected via `isVisionModel()` in `ollama.js`. Images are passed as base64 in the `images` array of message objects.
