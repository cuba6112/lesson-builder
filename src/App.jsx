import { useState, useEffect, useCallback, useRef } from 'react';
import LessonBuilder from './components/LessonBuilder';
import LessonLibrary from './components/LessonLibrary';
import {
  loadData,
  saveData,
  createNewLesson,
  duplicateLesson as duplicateLessonStorage
} from './services/storage';
import './index.css';

// Debounce helper
function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef(null);

  const debouncedFn = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

// Load initial data once (lazy initialization)
function getInitialData() {
  return loadData();
}

function App() {
  // Use lazy initialization to load from localStorage synchronously
  const [data, setData] = useState(getInitialData);
  const { lessons, activeLessonId } = data;
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Get active lesson
  const activeLesson = lessons.find(l => l.id === activeLessonId) || lessons[0];

  // Save to localStorage (debounced)
  const saveToStorage = useCallback((updatedLessons, newActiveLessonId) => {
    saveData({
      lessons: updatedLessons,
      activeLessonId: newActiveLessonId || activeLessonId,
    });
  }, [activeLessonId]);

  const debouncedSave = useDebouncedCallback(saveToStorage, 500);

  // Update lesson and save
  const updateLesson = useCallback((lessonId, updates) => {
    setData(prev => {
      const updatedLessons = prev.lessons.map(l =>
        l.id === lessonId
          ? { ...l, ...updates, updatedAt: Date.now() }
          : l
      );
      debouncedSave(updatedLessons, prev.activeLessonId);
      return { ...prev, lessons: updatedLessons };
    });
  }, [debouncedSave]);

  // Create new lesson
  const handleCreateLesson = useCallback(() => {
    const newLesson = createNewLesson();
    setData(prev => {
      const updated = [...prev.lessons, newLesson];
      saveData({ lessons: updated, activeLessonId: newLesson.id });
      return { lessons: updated, activeLessonId: newLesson.id };
    });
  }, []);

  // Select lesson
  const handleSelectLesson = useCallback((lessonId) => {
    setData(prev => {
      saveData({ lessons: prev.lessons, activeLessonId: lessonId });
      return { ...prev, activeLessonId: lessonId };
    });
    setIsLibraryOpen(false);
  }, []);

  // Delete lesson
  const handleDeleteLesson = useCallback((lessonId) => {
    setData(prev => {
      if (prev.lessons.length <= 1) return prev;
      const updated = prev.lessons.filter(l => l.id !== lessonId);
      const newActiveId = lessonId === prev.activeLessonId ? updated[0].id : prev.activeLessonId;
      saveData({ lessons: updated, activeLessonId: newActiveId });
      return { lessons: updated, activeLessonId: newActiveId };
    });
  }, []);

  // Duplicate lesson
  const handleDuplicateLesson = useCallback((lessonId) => {
    const duplicate = duplicateLessonStorage(lessonId);
    if (duplicate) {
      setData(prev => {
        const updated = [...prev.lessons, duplicate];
        saveData({ lessons: updated, activeLessonId: duplicate.id });
        return { lessons: updated, activeLessonId: duplicate.id };
      });
    }
  }, []);

  // Toggle library
  const toggleLibrary = useCallback(() => {
    setIsLibraryOpen(prev => !prev);
  }, []);

  const closeLibrary = useCallback(() => {
    setIsLibraryOpen(false);
  }, []);

  // Lesson state handlers (passed to LessonBuilder)
  const handleSetTitle = useCallback((title) => {
    if (activeLesson) {
      updateLesson(activeLesson.id, { title });
    }
  }, [activeLesson, updateLesson]);

  const handleSetIcon = useCallback((icon) => {
    if (activeLesson) {
      updateLesson(activeLesson.id, { icon });
    }
  }, [activeLesson, updateLesson]);

  const handleSetBlocks = useCallback((blocks) => {
    if (activeLesson) {
      updateLesson(activeLesson.id, { blocks });
    }
  }, [activeLesson, updateLesson]);

  // Don't render if no active lesson (edge case)
  if (!activeLesson) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Library Side Panel */}
      <LessonLibrary
        isOpen={isLibraryOpen}
        onClose={closeLibrary}
        lessons={lessons}
        activeLessonId={activeLessonId}
        onSelectLesson={handleSelectLesson}
        onCreateLesson={handleCreateLesson}
        onDeleteLesson={handleDeleteLesson}
        onDuplicateLesson={handleDuplicateLesson}
      />

      {/* Main Editor */}
      <LessonBuilder
        key={activeLesson.id}
        lesson={activeLesson}
        onSetTitle={handleSetTitle}
        onSetIcon={handleSetIcon}
        onSetBlocks={handleSetBlocks}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={toggleLibrary}
        lessonCount={lessons.length}
      />
    </div>
  );
}

export default App;
