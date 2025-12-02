import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Eye, Edit3, Save, Type, Video, HelpCircle, Image, MoreHorizontal, ChevronRight, FileText, Download, MessageCircle, Sparkles, Code } from 'lucide-react';
import AIChatPanel from './AIChatPanel';

// Slash Command Menu Component
const SlashCommandMenu = ({ position, onSelect, onClose, filter }) => {
  const commands = [
    { type: 'text', icon: Type, label: 'Text', description: 'Plain text block' },
    { type: 'heading', icon: FileText, label: 'Heading', description: 'Large section heading' },
    { type: 'image', icon: Image, label: 'Image', description: 'Upload or embed an image' },
    { type: 'video', icon: Video, label: 'Video', description: 'Embed a YouTube/Vimeo video' },
    { type: 'quiz', icon: HelpCircle, label: 'Quiz', description: 'Multiple choice question' },
    { type: 'html', icon: Code, label: 'HTML', description: 'Custom HTML content' },
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
};

// Notion-style Block Component
const Block = ({ block, isActive, onSelect, onDelete, onUpdate, onAddBlockAfter, blocks }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashFilter, setSlashFilter] = useState('');
  const textRef = useRef(null);
  const blockRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === '/' && block.type === 'text' && !block.content) {
      e.preventDefault();
      const rect = textRef.current?.getBoundingClientRect();
      const blockRect = blockRef.current?.getBoundingClientRect();
      if (rect && blockRect) {
        setSlashMenu({ top: 30, left: 0 });
        setSlashFilter('');
      }
    } else if (e.key === 'Enter' && !e.shiftKey && block.type === 'text') {
      e.preventDefault();
      onAddBlockAfter(block.id, 'text');
    } else if (e.key === 'Backspace' && !block.content && blocks.length > 1) {
      e.preventDefault();
      onDelete(block.id);
    }
  };

  const handleInput = (e) => {
    const value = e.target.innerText;

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
  };

  const handleSlashSelect = (type) => {
    setSlashMenu(null);
    setSlashFilter('');
    onUpdate(block.id, 'type', type);
    onUpdate(block.id, 'content', '');
    if (type === 'quiz') {
      onUpdate(block.id, 'options', ['', '']);
      onUpdate(block.id, 'correctAnswer', 0);
    }
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case 'text':
        return (
          <div
            ref={textRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            className="outline-none min-h-[1.5em] text-gray-700 leading-relaxed w-full"
            data-placeholder="Type '/' for commands..."
            style={{
              minHeight: '1.5em',
              wordBreak: 'break-word'
            }}
          >
            {block.content}
          </div>
        );

      case 'heading':
        return (
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onUpdate(block.id, 'content', e.target.innerText)}
            onFocus={() => onSelect(block.id)}
            className="outline-none text-2xl font-bold text-gray-900 min-h-[1.5em]"
            data-placeholder="Heading"
          >
            {block.content}
          </div>
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
                <div key={idx} className="flex items-center gap-2">
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
              <div className="relative">
                <div
                  className="prose prose-sm max-w-none p-4 bg-white rounded-lg border border-gray-200 min-h-[100px]"
                  dangerouslySetInnerHTML={{ __html: block.content || '<p class="text-gray-400">No HTML content</p>' }}
                />
                <button
                  onClick={() => onUpdate(block.id, 'showPreview', false)}
                  className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-1"
                >
                  <Code size={12} />
                  Edit
                </button>
              </div>
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
                  onFocus={() => onSelect(block.id)}
                  placeholder="<div>\n  <h3>Your HTML here</h3>\n  <p>Add any HTML content...</p>\n</div>"
                  className="w-full px-3 py-2 font-mono text-sm bg-gray-900 text-green-400 rounded-lg border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[150px] resize-y"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={blockRef}
      className={`group relative flex items-start gap-2 py-1 px-2 -mx-2 rounded-lg transition-colors ${
        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Block Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
        <button
          className="p-1 rounded hover:bg-gray-200 text-gray-400 cursor-grab"
          onMouseDown={(e) => e.preventDefault()}
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded hover:bg-gray-200 text-gray-400"
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
            onClose={() => setSlashMenu(null)}
            filter={slashFilter}
          />
        )}
      </div>

      {/* Delete Button */}
      <button
        onClick={() => onDelete(block.id)}
        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={14} />
      </button>

      {/* Add Block Menu */}
      {showMenu && (
        <div className="absolute left-8 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-56 animate-fadeIn">
          {[
            { type: 'text', icon: Type, label: 'Text' },
            { type: 'heading', icon: FileText, label: 'Heading' },
            { type: 'image', icon: Image, label: 'Image' },
            { type: 'video', icon: Video, label: 'Video' },
            { type: 'quiz', icon: HelpCircle, label: 'Quiz' },
            { type: 'html', icon: Code, label: 'HTML' },
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
};

// Helper function to extract YouTube video ID
const extractYouTubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : '';
};

// Main Application
export default function LessonBuilder() {
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonIcon, setLessonIcon] = useState("📚");
  const [blocks, setBlocks] = useState([
    { id: 1, type: 'heading', content: 'Welcome to your new lesson' },
    { id: 2, type: 'text', content: 'Start typing here or use "/" to add different block types...' }
  ]);
  const [isPreview, setIsPreview] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const addBlock = (type, afterId = null) => {
    const newBlock = {
      id: Date.now(),
      type,
      content: '',
      ...(type === 'quiz' && { options: ['', ''], correctAnswer: 0 }),
      ...(type === 'image' && { caption: '' }),
    };

    if (afterId) {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
    } else {
      setBlocks([...blocks, newBlock]);
    }

    setActiveBlockId(newBlock.id);
    return newBlock.id;
  };

  const deleteBlock = (id) => {
    if (blocks.length <= 1) return;
    const index = blocks.findIndex(b => b.id === id);
    setBlocks(blocks.filter(b => b.id !== id));
    // Focus previous block
    if (index > 0) {
      setActiveBlockId(blocks[index - 1].id);
    }
  };

  const updateBlock = (id, field, value) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleSave = () => {
    const data = JSON.stringify({
      title: lessonTitle || 'Untitled',
      icon: lessonIcon,
      blocks
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(lessonTitle || 'untitled').replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
  };

  // Add block from AI (with optional position and custom ID for streaming)
  const handleAIAddBlock = (blockData, afterId = null, customId = null) => {
    const newBlock = {
      id: customId || Date.now(),
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
      } else {
        return [...prev, newBlock];
      }
    });

    setActiveBlockId(newBlock.id);
    return newBlock.id;
  };

  // Move block to new position
  const moveBlock = (blockId, newIndex) => {
    const currentIndex = blocks.findIndex(b => b.id === blockId);
    if (currentIndex === -1) return;

    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(currentIndex, 1);
    newBlocks.splice(newIndex, 0, removed);
    setBlocks(newBlocks);
  };

  // Editor View
  const renderEditor = () => (
    <div className="max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pt-12">
        <button
          className="text-6xl mb-4 hover:bg-gray-100 rounded-lg p-2 transition-colors"
          onClick={() => {
            const icons = ['📚', '📖', '🎓', '💡', '🚀', '✨', '📝', '🎯', '💻', '🔬'];
            const currentIndex = icons.indexOf(lessonIcon);
            setLessonIcon(icons[(currentIndex + 1) % icons.length]);
          }}
        >
          {lessonIcon}
        </button>
        <input
          type="text"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
        />
        <p className="text-gray-400 text-sm mt-2">
          Type <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">/</kbd> in an empty text block to see commands
        </p>
      </div>

      {/* Blocks */}
      <div className="space-y-1">
        {blocks.map((block) => (
          <Block
            key={block.id}
            block={block}
            blocks={blocks}
            isActive={activeBlockId === block.id}
            onSelect={setActiveBlockId}
            onDelete={deleteBlock}
            onUpdate={updateBlock}
            onAddBlockAfter={addBlock}
          />
        ))}
      </div>

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
                      key={i}
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
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Notion-style Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{lessonIcon}</span>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">
              {lessonTitle || 'Untitled'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isAIPanelOpen
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles size={14} />
              AI
            </button>
            <button
              onClick={() => setIsPreview(!isPreview)}
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
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`px-6 pb-20 transition-all duration-300 ${isAIPanelOpen ? 'mr-96' : ''}`}>
        {isPreview ? renderPreview() : renderEditor()}
      </main>

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        blocks={blocks}
        onAddBlock={handleAIAddBlock}
        onUpdateBlock={updateBlock}
        onDeleteBlock={deleteBlock}
        onMoveBlock={moveBlock}
        onSetTitle={setLessonTitle}
        onSetIcon={setLessonIcon}
        lessonTitle={lessonTitle}
        lessonIcon={lessonIcon}
      />

      {/* Floating AI Button (when panel is closed) */}
      {!isAIPanelOpen && (
        <button
          onClick={() => setIsAIPanelOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        >
          <Sparkles size={24} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}
