import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import DOMPurify from 'dompurify';
import { Plus, Trash2, GripVertical, Eye, Edit3, AlignLeft, Video, ListChecks, Image, ChevronRight, Heading, Download, Code, FolderOpen, FileText, Hash, Braces, Zap, GitBranch, Calculator, HelpCircle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AIChatPanel from './AIChatPanel';
import ErrorBoundary from './ErrorBoundary';
import ReactBlock from './ReactBlock';
import MermaidBlock from './MermaidBlock';
import MathBlock from './MathBlock';
import { generateBlockId } from '../utils/ids';
import { downloadMarkdown } from '../services/export';
import LessonExportView from './LessonExportView';
import HelpModal from './HelpModal';

// Configure DOMPurify to allow safe styling
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Slash Command Menu Component
const SlashCommandMenu = memo(({ position, onSelect, onClose, filter }) => {
  const commands = [
    { type: 'text', icon: AlignLeft, label: 'Text', description: 'Plain text block' },
    { type: 'heading', icon: Heading, label: 'Heading', description: 'Large section heading' },
    { type: 'image', icon: Image, label: 'Image', description: 'Upload or embed an image' },
    { type: 'video', icon: Video, label: 'Video', description: 'Embed a YouTube/Vimeo video' },
    { type: 'quiz', icon: ListChecks, label: 'Quiz', description: 'Multiple choice question' },
    { type: 'html', icon: Code, label: 'HTML', description: 'Custom HTML content' },
    { type: 'code', icon: Braces, label: 'Code', description: 'Code snippet with syntax highlighting' },
    { type: 'react', icon: Zap, label: 'React', description: 'Interactive React component' },
    { type: 'mermaid', icon: GitBranch, label: 'Mermaid', description: 'Flowchart, sequence, or other diagram' },
    { type: 'math', icon: Calculator, label: 'Math', description: 'LaTeX math formula' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.type.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-72 animate-fadeIn"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
        Basic blocks
      </div>
      {filteredCommands.map((cmd) => (
        <button
          key={cmd.type}
          onClick={() => onSelect(cmd.type)}
          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200">
            <cmd.icon size={20} className="text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{cmd.label}</div>
            <div className="text-xs text-gray-500">{cmd.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

// Export Menu Component
const ExportMenu = memo(({ isOpen, onClose, onExport }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const exportOptions = [
    {
      id: 'pdf',
      icon: FileText,
      label: 'Export as PDF',
      description: 'High-quality printable document',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      id: 'markdown',
      icon: Hash,
      label: 'Export as Markdown',
      description: 'Plain text with formatting',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'json',
      icon: Braces,
      label: 'Export as JSON',
      description: 'Raw data for backup',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-64 animate-fadeIn z-50"
    >
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Export Lesson</p>
      </div>
      {exportOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => {
            onExport(option.id);
            onClose();
          }}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className={`w-10 h-10 rounded-lg ${option.bgColor} flex items-center justify-center`}>
            <option.icon size={20} className={option.color} />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{option.label}</div>
            <div className="text-xs text-gray-500">{option.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
});

ExportMenu.displayName = 'ExportMenu';

// ContentEditable component that properly handles cursor position
const ContentEditableBlock = memo(({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  className,
  style
}) => {
  const ref = useRef(null);
  const lastValue = useRef(value);

  // Only update DOM when value changes externally (not from user input)
  useEffect(() => {
    if (ref.current && value !== lastValue.current) {
      // Only update if the element doesn't have focus or value is empty
      if (document.activeElement !== ref.current || !value) {
        ref.current.textContent = value || '';
      }
      lastValue.current = value;
    }
  }, [value]);

  // Set initial content (intentionally runs once on mount)
  useEffect(() => {
    if (ref.current && value) {
      ref.current.textContent = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback((e) => {
    const newValue = e.target.textContent || '';
    lastValue.current = newValue;
    onChange(newValue);
  }, [onChange]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className={className}
      data-placeholder={placeholder}
      style={style}
    />
  );
});

ContentEditableBlock.displayName = 'ContentEditableBlock';

// Helper function to extract YouTube video ID
const extractYouTubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : '';
};

// Sanitize HTML content
const sanitizeHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'br', 'hr', 'pre', 'code',
      'blockquote', 'figure', 'figcaption', 'section', 'article', 'header', 'footer'],
    ALLOWED_ATTR: ['style', 'class', 'href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
};

// Notion-style Block Component
const Block = memo(({ block, isActive, onSelect, onDelete, onUpdate, onAddBlockAfter, index, blocks }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashFilter, setSlashFilter] = useState('');

  // Drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === '/' && block.type === 'text' && !block.content) {
      e.preventDefault();
      setSlashMenu({ top: 30, left: 0 });
      setSlashFilter('');
    } else if (e.key === 'Enter' && !e.shiftKey && block.type === 'text') {
      e.preventDefault();
      onAddBlockAfter(block.id, 'text');
    } else if (e.key === 'Backspace' && !block.content && blocks.length > 1) {
      e.preventDefault();
      onDelete(block.id);
    }
  }, [block.id, block.type, block.content, blocks.length, onAddBlockAfter, onDelete]);

  const handleContentChange = useCallback((value) => {
    // Check for slash command
    if (value.startsWith('/')) {
      const filter = value.slice(1);
      setSlashFilter(filter);
      if (!slashMenu) {
        setSlashMenu({ top: 30, left: 0 });
      }
    } else {
      setSlashMenu(null);
      setSlashFilter('');
    }
    onUpdate(block.id, 'content', value);
  }, [block.id, slashMenu, onUpdate]);

  const handleSlashSelect = useCallback((type) => {
    setSlashMenu(null);
    setSlashFilter('');
    // Batch updates into single object
    const updates = { type, content: '' };
    if (type === 'quiz') {
      updates.options = ['', ''];
      updates.correctAnswer = 0;
    }
    // Apply all updates
    Object.entries(updates).forEach(([field, value]) => {
      onUpdate(block.id, field, value);
    });
  }, [block.id, onUpdate]);

  const handleSelect = useCallback(() => {
    onSelect(block.id);
  }, [block.id, onSelect]);

  const handleDelete = useCallback(() => {
    onDelete(block.id);
  }, [block.id, onDelete]);

  const handleMenuToggle = useCallback(() => {
    setShowMenu(prev => !prev);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
  }, []);

  const renderBlockContent = () => {
    switch (block.type) {
      case 'text':
        return (
          <ContentEditableBlock
            value={block.content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onFocus={handleSelect}
            placeholder="Type '/' for commands..."
            className="outline-none min-h-[1.5em] text-gray-700 leading-relaxed w-full"
            style={{ minHeight: '1.5em', wordBreak: 'break-word' }}
          />
        );

      case 'heading':
        return (
          <ContentEditableBlock
            value={block.content}
            onChange={(value) => onUpdate(block.id, 'content', value)}
            onFocus={handleSelect}
            placeholder="Heading"
            className="outline-none text-2xl font-bold text-gray-900 min-h-[1.5em]"
          />
        );

      case 'image':
        return (
          <div className="w-full">
            {block.content ? (
              <div className="relative group">
                <img
                  src={block.content}
                  alt={block.caption || 'Image'}
                  className="max-w-full rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden items-center justify-center h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                  <span className="text-gray-400">Invalid image URL</span>
                </div>
                {block.caption !== undefined && (
                  <input
                    type="text"
                    value={block.caption || ''}
                    onChange={(e) => onUpdate(block.id, 'caption', e.target.value)}
                    placeholder="Add a caption..."
                    className="w-full mt-2 text-sm text-gray-500 text-center bg-transparent border-none outline-none"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => document.getElementById(`image-input-${block.id}`).click()}
                >
                  <div className="text-center">
                    <Image size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Click to add image URL</p>
                    <p className="text-xs text-gray-400 mt-1">or paste a link below</p>
                  </div>
                </div>
                <input
                  id={`image-input-${block.id}`}
                  type="text"
                  placeholder="Paste image URL here..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdate(block.id, 'content', e.target.value);
                      onUpdate(block.id, 'caption', '');
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value) {
                      onUpdate(block.id, 'content', e.target.value);
                      onUpdate(block.id, 'caption', '');
                    }
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="w-full">
            {block.content ? (
              <div className="relative">
                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                  {block.content.includes('youtube.com') || block.content.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(block.content)}`}
                      title={`YouTube video: ${block.content}`}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                    />
                  ) : (
                    <div className="text-center text-white">
                      <Video size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Video: {block.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Paste YouTube or Vimeo URL..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdate(block.id, 'content', e.target.value);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value) {
                    onUpdate(block.id, 'content', e.target.value);
                  }
                }}
              />
            )}
          </div>
        );

      case 'quiz':
        return (
          <div className="w-full bg-blue-50 rounded-lg p-4 border border-blue-100">
            <input
              type="text"
              value={block.content || ''}
              onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
              placeholder="Type your question here..."
              className="w-full text-lg font-medium bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 mb-4"
            />
            <div className="space-y-2">
              {block.options?.map((opt, idx) => (
                <div key={`${block.id}-opt-${idx}`} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`quiz-${block.id}`}
                    checked={block.correctAnswer === idx}
                    onChange={() => onUpdate(block.id, 'correctAnswer', idx)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...(block.options || [])];
                      newOptions[idx] = e.target.value;
                      onUpdate(block.id, 'options', newOptions);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {block.options.length > 2 && (
                    <button
                      onClick={() => {
                        const newOptions = block.options.filter((_, i) => i !== idx);
                        onUpdate(block.id, 'options', newOptions);
                        if (block.correctAnswer >= newOptions.length) {
                          onUpdate(block.id, 'correctAnswer', 0);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => onUpdate(block.id, 'options', [...(block.options || []), ''])}
                className="text-sm text-blue-600 font-medium hover:text-blue-800 mt-2"
              >
                + Add option
              </button>
            </div>
          </div>
        );

      case 'html':
        return (
          <div className="w-full">
            {block.showPreview ? (
              <ErrorBoundary
                title="HTML Render Error"
                message="The HTML content could not be displayed safely."
                onReset={() => onUpdate(block.id, 'showPreview', false)}
              >
                <div className="relative">
                  <div
                    className="prose prose-sm max-w-none p-4 bg-white rounded-lg border border-gray-200 min-h-[100px]"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHTML(block.content) || '<p class="text-gray-400">No HTML content</p>'
                    }}
                  />
                  <button
                    onClick={() => onUpdate(block.id, 'showPreview', false)}
                    className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-1"
                  >
                    <Code size={12} />
                    Edit
                  </button>
                </div>
              </ErrorBoundary>
            ) : (
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Code size={12} />
                    HTML
                  </span>
                  <button
                    onClick={() => onUpdate(block.id, 'showPreview', true)}
                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded text-green-700 flex items-center gap-1"
                  >
                    <Eye size={12} />
                    Preview
                  </button>
                </div>
                <textarea
                  value={block.content || ''}
                  onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
                  onFocus={handleSelect}
                  placeholder="<div>\n  <h3>Your HTML here</h3>\n  <p>Add any HTML content...</p>\n</div>"
                  className="w-full px-3 py-2 font-mono text-sm bg-gray-900 text-green-400 rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[150px] resize-y"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        );

      case 'code':
        return (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Braces size={14} className="text-purple-500" />
                <select
                  value={block.language || 'javascript'}
                  onChange={(e) => onUpdate(block.id, 'language', e.target.value)}
                  className="text-xs bg-gray-100 border-none rounded px-2 py-1 text-gray-600 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="sql">SQL</option>
                  <option value="bash">Bash</option>
                  <option value="java">Java</option>
                  <option value="csharp">C#</option>
                  <option value="cpp">C++</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="php">PHP</option>
                  <option value="ruby">Ruby</option>
                  <option value="swift">Swift</option>
                  <option value="kotlin">Kotlin</option>
                  <option value="yaml">YAML</option>
                  <option value="markdown">Markdown</option>
                  <option value="plaintext">Plain Text</option>
                </select>
              </div>
              {block.filename && (
                <span className="text-xs text-gray-400 font-mono">{block.filename}</span>
              )}
            </div>
            <div className="relative">
              <textarea
                value={block.content || ''}
                onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
                onFocus={handleSelect}
                placeholder="// Enter your code here..."
                className="w-full px-4 py-3 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[150px] resize-y leading-relaxed"
                spellCheck={false}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-500 font-mono">
                {block.language || 'javascript'}
              </div>
            </div>
            <input
              type="text"
              value={block.filename || ''}
              onChange={(e) => onUpdate(block.id, 'filename', e.target.value)}
              placeholder="Optional: filename.js"
              className="mt-2 w-full px-3 py-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        );

      case 'react':
        return (
          <div className="w-full" onClick={handleSelect}>
            <ReactBlock
              code={block.content || '<Button>Click me!</Button>'}
              onCodeChange={(newCode) => onUpdate(block.id, 'content', newCode)}
              isEditing={true}
              showEditor={true}
            />
          </div>
        );

      case 'mermaid':
        return (
          <div className="w-full" onClick={handleSelect}>
            <MermaidBlock
              code={block.content || 'graph TD\n    A[Start] --> B[End]'}
              onCodeChange={(newCode) => onUpdate(block.id, 'content', newCode)}
              isEditing={true}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-start gap-2 py-1 px-2 -mx-2 rounded-lg transition-colors ${
        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
      } ${isDragging ? 'shadow-lg bg-white' : ''}`}
    >
      {/* Block Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
        <button
          className="p-1 rounded hover:bg-gray-200 text-gray-400 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={handleMenuToggle}
          className="p-1 rounded hover:bg-gray-200 text-gray-400"
          aria-label="Add block"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Block Content */}
      <div className="flex-1 min-w-0 relative">
        {renderBlockContent()}

        {/* Slash Command Menu */}
        {slashMenu && (
          <SlashCommandMenu
            position={slashMenu}
            onSelect={handleSlashSelect}
            onClose={closeSlashMenu}
            filter={slashFilter}
          />
        )}
      </div>

      {/* Delete Button */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
          aria-label="Delete block"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Add Block Menu */}
      {showMenu && (
        <div className="absolute left-8 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-56 animate-fadeIn">
          {[
            { type: 'text', icon: AlignLeft, label: 'Text' },
            { type: 'heading', icon: Heading, label: 'Heading' },
            { type: 'image', icon: Image, label: 'Image' },
            { type: 'video', icon: Video, label: 'Video' },
            { type: 'quiz', icon: ListChecks, label: 'Quiz' },
            { type: 'html', icon: Code, label: 'HTML' },
            { type: 'code', icon: Braces, label: 'Code' },
          ].map((item) => (
            <button
              key={item.type}
              onClick={() => {
                onAddBlockAfter(block.id, item.type);
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left text-sm"
            >
              <item.icon size={16} className="text-gray-500" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

Block.displayName = 'Block';

// Main Application
export default function LessonBuilder({
  lesson,
  onSetTitle,
  onSetIcon,
  onSetBlocks,
  isLibraryOpen = false,
  onToggleLibrary,
  lessonCount = 1
}) {
  // Internal state synced from props
  const [lessonTitle, setLessonTitle] = useState(lesson?.title || "");
  const [lessonIcon, setLessonIcon] = useState(lesson?.icon || "📚");
  const [blocks, setBlocks] = useState(lesson?.blocks || [
    { id: generateBlockId(), type: 'heading', content: 'Welcome to your new lesson' },
    { id: generateBlockId(), type: 'text', content: 'Start typing here or use "/" to add different block types...' }
  ]);
  const [isPreview, setIsPreview] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setBlocks(prev => {
          const newBlocks = [...prev];
          const [removed] = newBlocks.splice(oldIndex, 1);
          newBlocks.splice(newIndex, 0, removed);
          return newBlocks;
        });
      }
    }
  }, [blocks]);

  // Sync blocks changes to parent
  const blocksRef = useRef(blocks);
  useEffect(() => {
    if (blocksRef.current !== blocks && onSetBlocks) {
      onSetBlocks(blocks);
      blocksRef.current = blocks;
    }
  }, [blocks, onSetBlocks]);

  // Handle title change
  const handleTitleChange = useCallback((newTitle) => {
    setLessonTitle(newTitle);
    onSetTitle?.(newTitle);
  }, [onSetTitle]);

  // Handle icon change
  const handleIconChange = useCallback((newIcon) => {
    setLessonIcon(newIcon);
    onSetIcon?.(newIcon);
  }, [onSetIcon]);

  const addBlock = useCallback((type, afterId = null) => {
    const newBlock = {
      id: generateBlockId(),
      type,
      content: '',
      ...(type === 'quiz' && { options: ['', ''], correctAnswer: 0 }),
      ...(type === 'image' && { caption: '' }),
    };

    setBlocks(prev => {
      if (afterId) {
        const index = prev.findIndex(b => b.id === afterId);
        const newBlocks = [...prev];
        newBlocks.splice(index + 1, 0, newBlock);
        return newBlocks;
      }
      return [...prev, newBlock];
    });

    setActiveBlockId(newBlock.id);
    return newBlock.id;
  }, []);

  const deleteBlock = useCallback((id) => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === id);
      const newBlocks = prev.filter(b => b.id !== id);

      // If deleting the last block, reset to a fresh empty block
      if (newBlocks.length === 0) {
        const freshBlock = { id: generateBlockId(), type: 'text', content: '' };
        setActiveBlockId(freshBlock.id);
        return [freshBlock];
      }

      // Focus previous block or first block
      if (index > 0) {
        setActiveBlockId(prev[index - 1].id);
      } else if (newBlocks.length > 0) {
        setActiveBlockId(newBlocks[0].id);
      }
      return newBlocks;
    });
  }, []);

  const updateBlock = useCallback((id, field, value) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }, []);

  // Export handlers
  const handleExport = useCallback(async (format) => {
    const lessonData = {
      title: lessonTitle || 'Untitled',
      icon: lessonIcon,
      blocks
    };

    setIsExporting(true);

    try {
      switch (format) {
        case 'pdf':
          // Use browser-native print-to-PDF approach
          setIsExportMode(true);
          break;

        case 'markdown':
          downloadMarkdown(lessonData);
          break;

        case 'json':
        default: {
          const data = JSON.stringify(lessonData, null, 2);
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(lessonTitle || 'untitled').replace(/\s+/g, '_').toLowerCase()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`Export failed: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setIsExporting(false);
    }
  }, [lessonTitle, lessonIcon, blocks]);

  const toggleExportMenu = useCallback(() => {
    setIsExportMenuOpen(prev => !prev);
  }, []);

  const closeExportMenu = useCallback(() => {
    setIsExportMenuOpen(false);
  }, []);

  // Add block from AI (with optional position and custom ID for streaming)
  const handleAIAddBlock = useCallback((blockData, afterId = null, customId = null) => {
    const newBlock = {
      id: customId || generateBlockId(),
      ...blockData,
      ...(blockData.type === 'quiz' && !blockData.options && { options: ['', ''], correctAnswer: 0 }),
      ...(blockData.type === 'image' && blockData.caption === undefined && { caption: '' }),
    };

    setBlocks(prev => {
      if (afterId) {
        const index = prev.findIndex(b => b.id === afterId);
        const newBlocks = [...prev];
        newBlocks.splice(index + 1, 0, newBlock);
        return newBlocks;
      }
      return [...prev, newBlock];
    });

    setActiveBlockId(newBlock.id);
    return newBlock.id;
  }, []);

  // Move block to new position
  const moveBlock = useCallback((blockId, newIndex) => {
    setBlocks(prev => {
      const currentIndex = prev.findIndex(b => b.id === blockId);
      if (currentIndex === -1) return prev;

      const newBlocks = [...prev];
      const [removed] = newBlocks.splice(currentIndex, 1);
      newBlocks.splice(newIndex, 0, removed);
      return newBlocks;
    });
  }, []);

  const toggleAIPanel = useCallback(() => {
    setIsAIPanelOpen(prev => !prev);
  }, []);

  const closeAIPanel = useCallback(() => {
    setIsAIPanelOpen(false);
  }, []);

  const openAIPanel = useCallback(() => {
    setIsAIPanelOpen(true);
  }, []);

  const togglePreview = useCallback(() => {
    setIsPreview(prev => !prev);
  }, []);

  const cycleIcon = useCallback(() => {
    const icons = ['📚', '📖', '🎓', '💡', '🚀', '✨', '📝', '🎯', '💻', '🔬'];
    const currentIndex = icons.indexOf(lessonIcon);
    const newIcon = icons[(currentIndex + 1) % icons.length];
    handleIconChange(newIcon);
  }, [lessonIcon, handleIconChange]);

  // Editor View
  const renderEditor = () => (
    <div className="max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pt-12">
        <button
          className="text-6xl mb-4 hover:bg-gray-100 rounded-lg p-2 transition-colors"
          onClick={cycleIcon}
          aria-label="Change lesson icon"
        >
          {lessonIcon}
        </button>
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
        />
        <p className="text-gray-400 text-sm mt-2">
          Type <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">/</kbd> in an empty text block to see commands
        </p>
      </div>

      {/* Blocks with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {blocks.map((block, index) => (
              <Block
                key={block.id}
                block={block}
                blocks={blocks}
                index={index}
                isActive={activeBlockId === block.id}
                onSelect={setActiveBlockId}
                onDelete={deleteBlock}
                onUpdate={updateBlock}
                onAddBlockAfter={addBlock}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Block Button */}
      <button
        onClick={() => addBlock('text')}
        className="w-full py-3 mt-4 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-gray-300"
      >
        <Plus size={16} />
        <span className="text-sm">Add a block</span>
      </button>
    </div>
  );

  // Preview View
  const renderPreview = () => (
    <div className="max-w-3xl mx-auto bg-white min-h-screen">
      <div className="pt-12 pb-8">
        <span className="text-6xl mb-4 block">{lessonIcon}</span>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {lessonTitle || 'Untitled'}
        </h1>
        <p className="text-gray-500 text-sm">
          {blocks.length} blocks
        </p>
      </div>

      <div className="space-y-6">
        {blocks.map((block) => (
          <div key={block.id}>
            {block.type === 'heading' && (
              <h2 className="text-2xl font-bold text-gray-900">
                {block.content || 'Untitled'}
              </h2>
            )}

            {block.type === 'text' && (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {block.content || <span className="text-gray-400 italic">Empty block</span>}
              </p>
            )}

            {block.type === 'image' && block.content && (
              <figure>
                <img
                  src={block.content}
                  alt={block.caption || ''}
                  className="rounded-lg max-w-full"
                />
                {block.caption && (
                  <figcaption className="text-center text-sm text-gray-500 mt-2">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            )}

            {block.type === 'video' && block.content && (
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {(block.content.includes('youtube.com') || block.content.includes('youtu.be')) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(block.content)}`}
                    title={`YouTube video: ${block.content}`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Video size={48} className="opacity-50" />
                  </div>
                )}
              </div>
            )}

            {block.type === 'quiz' && (
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
                <p className="text-lg font-medium text-gray-900 mb-4">
                  {block.content || 'Question'}
                </p>
                <div className="space-y-2">
                  {block.options?.map((opt, i) => (
                    <label
                      key={`preview-${block.id}-opt-${i}`}
                      className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
                    >
                      <input
                        type="radio"
                        name={`preview-quiz-${block.id}`}
                        className="text-blue-600"
                      />
                      <span className="ml-3 text-gray-700">{opt || `Option ${i + 1}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {block.type === 'html' && block.content && (
              <ErrorBoundary
                title="HTML Render Error"
                message="The HTML content could not be displayed."
              >
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(block.content) }}
                />
              </ErrorBoundary>
            )}

            {block.type === 'code' && block.content && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                {block.filename && (
                  <div className="bg-gray-100 px-4 py-2 text-xs font-mono text-gray-600 border-b border-gray-200 flex items-center gap-2">
                    <Braces size={12} />
                    {block.filename}
                  </div>
                )}
                <pre className="bg-gray-900 p-4 overflow-x-auto">
                  <code className={`text-sm font-mono text-gray-100 language-${block.language || 'javascript'}`}>
                    {block.content}
                  </code>
                </pre>
                {block.language && (
                  <div className="bg-gray-800 px-4 py-1.5 text-xs text-gray-400 font-mono text-right">
                    {block.language}
                  </div>
                )}
              </div>
            )}

            {block.type === 'react' && (
              <ErrorBoundary>
                <ReactBlock
                  code={block.content || '// Write your React code here\n<Button>Click me!</Button>'}
                  onCodeChange={(newCode) => updateBlock(block.id, 'content', newCode)}
                  isEditing={!isPreview}
                  showEditor={true}
                />
              </ErrorBoundary>
            )}

            {block.type === 'mermaid' && (
              <ErrorBoundary>
                <MermaidBlock
                  code={block.content || 'graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Do it]\n    B -->|No| D[Skip it]'}
                  onCodeChange={(newCode) => updateBlock(block.id, 'content', newCode)}
                  isEditing={!isPreview}
                />
              </ErrorBoundary>
            )}

            {block.type === 'math' && (
              <ErrorBoundary>
                <MathBlock
                  code={block.content || 'E = mc^2'}
                  onCodeChange={(newCode) => updateBlock(block.id, 'content', newCode)}
                  isEditing={!isPreview}
                />
              </ErrorBoundary>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Calculate margins based on open panels
  const mainMargins = `${isLibraryOpen ? 'ml-72' : ''} ${isAIPanelOpen ? 'mr-96' : ''}`;

  // Show export view when in export mode (for PDF)
  if (isExportMode) {
    return (
      <LessonExportView
        lesson={{
          title: lessonTitle || 'Untitled',
          icon: lessonIcon,
          blocks
        }}
        onClose={() => setIsExportMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Notion-style Header */}
      <header className={`sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100 transition-all duration-300 ${isLibraryOpen ? 'ml-72' : ''}`}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {/* Library Toggle */}
            <button
              onClick={onToggleLibrary}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                isLibraryOpen
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-label="Toggle library"
            >
              <FolderOpen size={16} />
              {lessonCount > 1 && (
                <span className="text-xs font-medium">{lessonCount}</span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span>{lessonIcon}</span>
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">
                {lessonTitle || 'Untitled'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={togglePreview}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isPreview
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {isPreview ? (
                <span className="flex items-center gap-1.5">
                  <Edit3 size={14} />
                  Edit
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  Preview
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={toggleExportMenu}
                disabled={isExporting}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isExportMenuOpen
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isExporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Export
                  </>
                )}
              </button>
              <ExportMenu
                isOpen={isExportMenuOpen}
                onClose={closeExportMenu}
                onExport={handleExport}
              />
            </div>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-2 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              aria-label="Help"
              title="Help & Getting Started"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Main Content */}
      <main className={`px-6 pb-20 transition-all duration-300 ${mainMargins}`}>
        {isPreview ? renderPreview() : renderEditor()}
      </main>

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={isAIPanelOpen}
        onClose={closeAIPanel}
        blocks={blocks}
        onAddBlock={handleAIAddBlock}
        onUpdateBlock={updateBlock}
        onDeleteBlock={deleteBlock}
        onMoveBlock={moveBlock}
        onSetTitle={handleTitleChange}
        onSetIcon={handleIconChange}
        lessonTitle={lessonTitle}
        lessonIcon={lessonIcon}
        lessonId={lesson?.id}
      />

      {/* Floating AI Button (when panel is closed) */}
      {!isAIPanelOpen && (
        <button
          onClick={openAIPanel}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
          aria-label="Open AI Assistant"
        >
          <span className="text-2xl group-hover:scale-110 transition-transform">🦑</span>
        </button>
      )}
    </div>
  );
}
