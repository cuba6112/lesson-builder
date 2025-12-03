import React, { useState } from 'react';
import { X, HelpCircle, Download, Cpu, MessageSquare, Lightbulb, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const Section = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center gap-3 text-left transition-colors"
      >
        <Icon size={18} className="text-purple-600" />
        <span className="font-medium text-gray-900 flex-1">{title}</span>
        {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-white text-sm text-gray-700 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <HelpCircle size={24} className="text-white" />
            <h2 className="text-xl font-bold text-white">Help & Getting Started</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Quick Intro */}
          <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
            <p className="text-purple-900">
              <strong>Ika Lesson Builder</strong> is an AI-powered tool for creating beautiful educational content.
              It uses <strong>Ollama</strong> to run AI models locally on your computer.
            </p>
          </div>

          <Section title="Installing Ollama" icon={Download} defaultOpen={true}>
            <p>Ollama lets you run AI models locally. Here's how to set it up:</p>

            <ol className="list-decimal list-inside space-y-2 mt-3">
              <li>
                <strong>Download Ollama</strong> from{' '}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline inline-flex items-center gap-1"
                >
                  ollama.com <ExternalLink size={12} />
                </a>
              </li>
              <li><strong>Install</strong> the application (drag to Applications on Mac)</li>
              <li><strong>Open Ollama</strong> - it runs in your menu bar</li>
              <li>
                <strong>Pull a model</strong> - open Terminal and run:
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto">
                  ollama pull cogito:8b
                </pre>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-xs">
                <strong>Note:</strong> Make sure Ollama is running (check your menu bar) before using Ika.
              </p>
            </div>
          </Section>

          <Section title="Recommended Models" icon={Cpu}>
            <p className="mb-3">Different models have different strengths. Here are our recommendations:</p>

            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⭐</span>
                  <strong className="text-green-800">Cogito (Best for Lessons)</strong>
                </div>
                <p className="text-green-700 text-xs">
                  Excellent at creating structured educational content with clear explanations.
                  Highly recommended for lesson building.
                </p>
                <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs">
                  ollama pull cogito:8b
                </pre>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-blue-800">Llama 3.2 (Fast & Reliable)</strong>
                </div>
                <p className="text-blue-700 text-xs">
                  Good all-around model, fast responses. Great for general tasks.
                </p>
                <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs">
                  ollama pull llama3.2:3b
                </pre>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-purple-800">Qwen 2.5 (Tool Calling)</strong>
                </div>
                <p className="text-purple-700 text-xs">
                  Excellent at following instructions and using tools. Good for agent mode.
                </p>
                <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs">
                  ollama pull qwen2.5:7b
                </pre>
              </div>
            </div>
          </Section>

          <Section title="Using Ika Agent" icon={MessageSquare}>
            <p className="mb-3">Ika is your AI assistant that can create and modify lessons. Here's how to use it:</p>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Creating Lessons</h4>
                <p className="text-gray-600 mb-2">Just tell Ika what you want to teach:</p>
                <ul className="space-y-1 text-xs">
                  <li className="p-2 bg-gray-100 rounded"><code>"Create a lesson about photosynthesis"</code></li>
                  <li className="p-2 bg-gray-100 rounded"><code>"Make a tutorial on Python loops"</code></li>
                  <li className="p-2 bg-gray-100 rounded"><code>"Write a lesson explaining the solar system"</code></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Adding Blocks</h4>
                <p className="text-gray-600 mb-2">Add specific content types:</p>
                <ul className="space-y-1 text-xs">
                  <li className="p-2 bg-gray-100 rounded"><code>"Add a quiz about this topic"</code></li>
                  <li className="p-2 bg-gray-100 rounded"><code>"Create a diagram showing the process"</code></li>
                  <li className="p-2 bg-gray-100 rounded"><code>"Add a code example in JavaScript"</code></li>
                  <li className="p-2 bg-gray-100 rounded"><code>"Add a math formula for the quadratic equation"</code></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Agent Mode vs Legacy Mode</h4>
                <p className="text-gray-600 text-xs">
                  <strong>Agent Mode (default):</strong> Ika uses tools to directly create and modify content on the canvas.
                  Best for structured lesson creation.
                </p>
                <p className="text-gray-600 text-xs mt-2">
                  <strong>Legacy Mode:</strong> Simple chat without tools. Toggle in settings if you prefer conversational responses.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Tips & Tricks" icon={Lightbulb}>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span>💡</span>
                <span>Use <strong>/</strong> in any text block to quickly add new block types</span>
              </li>
              <li className="flex gap-2">
                <span>🖱️</span>
                <span>Drag blocks using the grip handle on the left to reorder</span>
              </li>
              <li className="flex gap-2">
                <span>📎</span>
                <span>Attach PDFs or documents to ask Ika questions about them</span>
              </li>
              <li className="flex gap-2">
                <span>⚡</span>
                <span>Lesson creation streams content in parallel for faster generation</span>
              </li>
              <li className="flex gap-2">
                <span>📊</span>
                <span>Use Mermaid blocks for flowcharts, diagrams, and visualizations</span>
              </li>
              <li className="flex gap-2">
                <span>📐</span>
                <span>Use Math blocks for LaTeX formulas and equations</span>
              </li>
              <li className="flex gap-2">
                <span>💾</span>
                <span>Lessons auto-save to your browser's local storage</span>
              </li>
              <li className="flex gap-2">
                <span>📥</span>
                <span>Export to PDF or Markdown using the download button</span>
              </li>
            </ul>
          </Section>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>Ika Lesson Builder v1.0.0-beta</p>
            <p className="mt-1">Built with Tauri, React, and Ollama</p>
          </div>
        </div>
      </div>
    </div>
  );
}
