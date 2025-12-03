import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GitBranch, Eye, EyeOff, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

// Lazy load mermaid library
let mermaidInstance = null;
let mermaidPromise = null;

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = import('mermaid').then((mod) => {
    mermaidInstance = mod.default;
    // Initialize mermaid with custom config
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
      },
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        barGap: 4,
      },
    });
    return mermaidInstance;
  });

  return mermaidPromise;
}

// Generate unique ID for each diagram
let diagramId = 0;
const generateId = () => `mermaid-diagram-${++diagramId}-${Date.now()}`;

export default function MermaidBlock({
  code = '',
  onCodeChange,
  isEditing = false,
}) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [editorVisible, setEditorVisible] = useState(isEditing);
  const [localCode, setLocalCode] = useState(code);
  const [renderCount, setRenderCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Derive loading state from render vs completed counts
  const isLoading = renderCount > completedCount;

  const renderDiagram = useCallback(async (diagramCode) => {
    if (!diagramCode?.trim()) {
      return { svg: '', error: null };
    }

    try {
      // Lazy load mermaid
      const mermaid = await getMermaid();

      // Validate syntax first
      await mermaid.parse(diagramCode);

      // Render the diagram
      const id = generateId();
      const { svg: renderedSvg } = await mermaid.render(id, diagramCode);
      return { svg: renderedSvg, error: null };
    } catch (err) {
      console.error('Mermaid render error:', err);
      return { svg: '', error: err.message || 'Failed to render diagram' };
    }
  }, []);

  // Render on code change
  useEffect(() => {
    let isMounted = true;
    const currentCode = isEditing ? localCode : code;

    if (!currentCode?.trim()) {
      setSvg('');
      setError(null);
      return;
    }

    // Increment render count to trigger loading state
    setRenderCount(c => c + 1);

    renderDiagram(currentCode).then((result) => {
      if (isMounted) {
        setSvg(result.svg);
        setError(result.error);
        setCompletedCount(c => c + 1);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [code, localCode, isEditing, renderDiagram]);

  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  const handleRefresh = () => {
    renderDiagram(isEditing ? localCode : code).then((result) => {
      setSvg(result.svg);
      setError(result.error);
    });
  };

  return (
    <div className="mermaid-block rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="flex items-center gap-2 text-white">
          <GitBranch size={16} />
          <span className="text-sm font-medium">Mermaid Diagram</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Refresh diagram"
          >
            <RefreshCw size={14} />
          </button>
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
            value={isEditing ? localCode : code}
            onChange={handleCodeChange}
            disabled={!isEditing}
            placeholder={`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Option 1]
    B -->|No| D[Option 2]
    C --> E[End]
    D --> E`}
            className="w-full p-4 font-mono text-sm bg-slate-800 text-gray-100 outline-none resize-none"
            style={{ minHeight: '120px' }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Diagram Preview */}
      <div className="bg-white p-4" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Loading diagram...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Diagram Error</p>
              <p className="text-sm mt-1 font-mono">{error}</p>
            </div>
          </div>
        ) : svg ? (
          <div
            className="mermaid-svg flex justify-center overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="text-center py-8 text-gray-400">
            <GitBranch size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Enter Mermaid code to render a diagram</p>
          </div>
        )}
      </div>

      {/* Help text */}
      {editorVisible && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Supports: flowchart, sequence, class, state, ER, gantt, pie, mindmap
        </div>
      )}
    </div>
  );
}
