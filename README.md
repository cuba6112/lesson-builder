# Lesson Builder

A Notion-like lesson builder with AI-powered content generation using Ollama.

## Features

- **Notion-style Editor**: Block-based editing with slash commands
- **Multiple Block Types**: Text, Heading, Image, Video, Quiz, HTML
- **AI Assistant**: Generate lessons, tables, code examples, quizzes
- **Interactive HTML**: AI creates styled, interactive HTML content
- **Real-time Thinking**: See AI progress in chat while content appears on canvas

## Block Types

- `/text` - Plain text block
- `/heading` - Section heading
- `/image` - Image with URL and caption
- `/video` - YouTube/Vimeo embed
- `/quiz` - Multiple choice questions
- `/html` - Custom HTML content

## AI Commands

- "Create a lesson about [topic]" - Full lesson with intro, content, examples, quiz
- "Add a table about [topic]" - Comparison/data table
- "Add a code example for [topic]" - Syntax-highlighted code block
- "Add a quiz about [topic]" - Interactive quiz questions
- "Add a list about [topic]" - Styled list

## Tech Stack

- React + Vite
- Tailwind CSS v4
- Lucide React icons
- Ollama for AI (local LLM)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start Ollama with a model (default: gpt-oss:20b):
```bash
ollama run gpt-oss:20b
```

3. Run the dev server:
```bash
npm run dev
```

4. Open http://localhost:5173

## Configuration

Default AI model is `gpt-oss:20b`. Change it in the AI panel settings.

For vision features (image analysis), install `llava`:
```bash
ollama pull llava
```

## License

MIT
