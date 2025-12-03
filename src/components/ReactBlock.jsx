import React, { useState } from 'react';
import { LiveProvider, LiveError, LivePreview } from 'react-live';
import { Code, Eye, EyeOff, Play } from 'lucide-react';
import { scopeComponents } from './reactBlockScope';

// Theme for the code editor
const editorTheme = {
  plain: {
    color: '#e2e8f0',
    backgroundColor: '#1e293b',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6b7280' } },
    { types: ['punctuation'], style: { color: '#94a3b8' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'], style: { color: '#f59e0b' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin'], style: { color: '#10b981' } },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#60a5fa' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#c084fc' } },
    { types: ['function', 'class-name'], style: { color: '#f472b6' } },
    { types: ['regex', 'important'], style: { color: '#f87171' } },
  ],
};

// Process code for inline mode - just return valid JSX expression
const processCode = (code) => {
  if (!code || !code.trim()) {
    return '<div style={{padding: "20px", textAlign: "center", color: "#888"}}>Write some React code!</div>';
  }

  let trimmed = code.trim();

  // Remove render() wrapper if present (from old code or AI-generated)
  if (trimmed.includes('render(')) {
    // Extract content from render(<.../>)  or render(<...>...</...>)
    trimmed = trimmed
      .replace(/render\s*\(\s*(<[\s\S]*>)\s*\)\s*;?\s*$/m, '$1')
      .replace(/^[\s\S]*?render\s*\(\s*(<[\s\S]*>)\s*\)\s*;?\s*$/m, '$1');
  }

  // If it's a component definition, wrap in IIFE that returns the component
  if (trimmed.startsWith('const App') || trimmed.startsWith('function App')) {
    return `(() => { ${trimmed}; return <App />; })()`;
  }

  // If it's any other const/function, try to use it
  if (trimmed.startsWith('const') || trimmed.startsWith('function')) {
    // Extract the component name
    const match = trimmed.match(/(?:const|function)\s+(\w+)/);
    if (match) {
      const compName = match[1];
      return `(() => { ${trimmed}; return <${compName} />; })()`;
    }
  }

  // If it's already JSX, return as-is
  if (trimmed.startsWith('<') || trimmed.startsWith('(')) {
    return trimmed;
  }

  // Default: wrap in fragment
  return `<>${trimmed}</>`;
};

export default function ReactBlock({
  code = '',
  onCodeChange,
  isEditing = false,
  showEditor = true,
}) {
  const [localCode, setLocalCode] = useState(code);
  const [editorVisible, setEditorVisible] = useState(showEditor);

  const handleCodeChange = (newCode) => {
    setLocalCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const rawCode = isEditing ? localCode : code;
  const displayCode = processCode(rawCode);

  return (
    <div className="react-block rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="flex items-center gap-2 text-white">
          <Code size={16} />
          <span className="text-sm font-medium">Interactive React</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorVisible(!editorVisible)}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            title={editorVisible ? 'Hide code' : 'Show code'}
          >
            {editorVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Code Editor */}
      {editorVisible && (
        <div className="border-b border-gray-200">
          <textarea
            value={rawCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            disabled={!isEditing}
            placeholder={`// Simple JSX:\n<Button onClick={() => alert('Hi!')}>Click me</Button>\n\n// Or with state:\nconst App = () => {\n  const [count, setCount] = useState(0);\n  return <Button onClick={() => setCount(c => c + 1)}>Count: {count}</Button>;\n};\nrender(<App />)`}
            className="w-full p-4 font-mono text-sm bg-slate-800 text-gray-100 outline-none resize-none"
            style={{ minHeight: '120px' }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Live Preview */}
      <LiveProvider
        code={displayCode}
        scope={scopeComponents}
        theme={editorTheme}
      >
        <div className="bg-white p-4">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Play size={12} />
            Live Preview
          </div>
          <div className="preview-container">
            <LivePreview />
          </div>
          <LiveError
            className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-mono"
          />
        </div>
      </LiveProvider>
    </div>
  );
}
