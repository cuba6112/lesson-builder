import React, { useState, useCallback, memo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Copy,
  ChevronLeft,
  Clock,
  MoreHorizontal,
  FolderOpen,
  X
} from 'lucide-react';

// Format relative time
const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Get preview text from blocks
const getPreviewText = (blocks) => {
  const textBlocks = blocks.filter(b => b.type === 'text' || b.type === 'heading');
  const preview = textBlocks
    .map(b => b.content)
    .filter(Boolean)
    .join(' ')
    .slice(0, 100);
  return preview || 'Empty lesson';
};

// Get block count summary
const getBlockSummary = (blocks) => {
  const count = blocks.length;
  return `${count} block${count !== 1 ? 's' : ''}`;
};

// Lesson Card Component
const LessonCard = memo(({
  lesson,
  isActive,
  onSelect,
  onDelete,
  onDuplicate
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuClick = useCallback((e) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
  }, []);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete(lesson.id);
  }, [lesson.id, onDelete]);

  const handleDuplicate = useCallback((e) => {
    e.stopPropagation();
    setShowMenu(false);
    onDuplicate(lesson.id);
  }, [lesson.id, onDuplicate]);

  const handleSelect = useCallback(() => {
    onSelect(lesson.id);
  }, [lesson.id, onSelect]);

  return (
    <div
      onClick={handleSelect}
      className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-blue-50 border-2 border-blue-200'
          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xl flex-shrink-0">{lesson.icon}</span>
          <h3 className="font-medium text-gray-900 truncate text-sm">
            {lesson.title || 'Untitled'}
          </h3>
        </div>
        <button
          onClick={handleMenuClick}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="More options"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Preview */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-2 min-h-[2.5em]">
        {getPreviewText(lesson.blocks)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{formatRelativeTime(lesson.updatedAt)}</span>
        </div>
        <span>{getBlockSummary(lesson.blocks)}</span>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div className="absolute right-2 top-10 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-36 animate-fadeIn">
            <button
              onClick={handleDuplicate}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r" />
      )}
    </div>
  );
});

LessonCard.displayName = 'LessonCard';

// Main Library Component
export default function LessonLibrary({
  isOpen,
  onClose,
  lessons,
  activeLessonId,
  onSelectLesson,
  onCreateLesson,
  onDeleteLesson,
  onDuplicateLesson
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt' | 'createdAt' | 'title'

  // Filter and sort lessons
  const filteredLessons = lessons
    .filter(lesson => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        lesson.title.toLowerCase().includes(query) ||
        lesson.blocks.some(b => b.content?.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return b[sortBy] - a[sortBy];
    });

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSortChange = useCallback((e) => {
    setSortBy(e.target.value);
  }, []);

  const handleDelete = useCallback((lessonId) => {
    if (lessons.length <= 1) {
      alert('Cannot delete the only lesson');
      return;
    }
    if (window.confirm('Delete this lesson? This cannot be undone.')) {
      onDeleteLesson(lessonId);
    }
  }, [lessons.length, onDeleteLesson]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-0 h-full w-72 bg-gray-50 border-r border-gray-200 z-50 flex flex-col animate-slideInLeft shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-gray-600" />
            <h2 className="font-semibold text-gray-900">Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Close library"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search lessons..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 text-gray-400"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* New Lesson Button */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onCreateLesson}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          New Lesson
        </button>
      </div>

      {/* Sort Controls */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''}
        </span>
        <select
          value={sortBy}
          onChange={handleSortChange}
          className="text-xs text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer pr-6"
        >
          <option value="updatedAt">Last modified</option>
          <option value="createdAt">Date created</option>
          <option value="title">Title</option>
        </select>
      </div>

      {/* Lessons List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredLessons.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {searchQuery ? 'No lessons found' : 'No lessons yet'}
            </p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filteredLessons.map(lesson => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isActive={lesson.id === activeLessonId}
              onSelect={onSelectLesson}
              onDelete={handleDelete}
              onDuplicate={onDuplicateLesson}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-400 text-center">
          Auto-saved to browser storage
        </p>
      </div>
    </div>
  );
}
