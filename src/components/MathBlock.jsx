import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Calculator, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

// Lazy load KaTeX
let katexInstance = null;
let katexPromise = null;

async function getKatex() {
  if (katexInstance) return katexInstance;
  if (katexPromise) return katexPromise;

  katexPromise = Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css')
  ]).then(([mod]) => {
    katexInstance = mod.default;
    return katexInstance;
  });

  return katexPromise;
}

export default function MathBlock({
  code = '',
  onCodeChange,
  isEditing = false,
}) {
  const containerRef = useRef(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState(null);
  const [editorVisible, setEditorVisible] = useState(isEditing);
  const [localCode, setLocalCode] = useState(code);
  const [isLoading, setIsLoading] = useState(false);

  const renderMath = useCallback(async (latex) => {
    if (!latex?.trim()) {
      return { html: '', error: null };
    }

    try {
      setIsLoading(true);
      const katex = await getKatex();

      // Check if it's display mode (block) or inline
      const isDisplayMode = latex.includes('\\begin{') ||
                           latex.includes('\\\\') ||
                           latex.includes('\\frac') ||
                           latex.includes('\\sum') ||
                           latex.includes('\\int') ||
                           latex.includes('\\lim') ||
                           !latex.includes('$');

      const renderedHtml = katex.renderToString(latex.replace(/^\$+|\$+$/g, ''), {
        throwOnError: false,
        displayMode: isDisplayMode,
        trust: true,
        strict: false,
      });

      return { html: renderedHtml, error: null };
    } catch (err) {
      console.error('KaTeX render error:', err);
      return { html: '', error: err.message || 'Failed to render formula' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Render on code change
  useEffect(() => {
    let isMounted = true;
    const currentCode = isEditing ? localCode : code;

    if (!currentCode?.trim()) {
      setHtml('');
      setError(null);
      return;
    }

    renderMath(currentCode).then((result) => {
      if (isMounted) {
        setHtml(result.html);
        setError(result.error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [code, localCode, isEditing, renderMath]);

  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  return (
    <div className="math-block rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center gap-2 text-white">
          <Calculator size={16} />
          <span className="text-sm font-medium">Math Formula</span>
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

      {/* LaTeX Editor */}
      {editorVisible && (
        <div className="border-b border-gray-200">
          <textarea
            value={isEditing ? localCode : code}
            onChange={handleCodeChange}
            disabled={!isEditing}
            placeholder={`E = mc^2

\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}

\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}

\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}`}
            className="w-full p-4 font-mono text-sm bg-slate-800 text-gray-100 outline-none resize-none"
            style={{ minHeight: '100px' }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Math Preview */}
      <div className="bg-white p-6" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Rendering formula...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Formula Error</p>
              <p className="text-sm mt-1 font-mono">{error}</p>
            </div>
          </div>
        ) : html ? (
          <div
            className="math-preview flex justify-center text-xl"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="text-center py-4 text-gray-400">
            <Calculator size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Enter LaTeX to render a formula</p>
          </div>
        )}
      </div>

      {/* Help text */}
      {editorVisible && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          LaTeX syntax: \frac{"{a}{b}"}, \sqrt{"{x}"}, \sum, \int, ^{"{superscript}"}, _{"{subscript}"}
        </div>
      )}
    </div>
  );
}
