// LocalStorage service for lesson persistence

import { generateBlockId } from '../utils/ids';

const STORAGE_KEY = 'lesson-builder-data';
const CHAT_STORAGE_KEY = 'lesson-builder-chat';
const SETTINGS_STORAGE_KEY = 'lesson-builder-settings';

// Default lesson structure
export function createNewLesson(title = 'Untitled', icon = '📚') {
  const now = Date.now();
  return {
    id: generateBlockId(),
    title,
    icon,
    blocks: [
      { id: generateBlockId(), type: 'heading', content: 'Welcome to your new lesson' },
      { id: generateBlockId(), type: 'text', content: 'Start typing here or use "/" to add different block types...' }
    ],
    createdAt: now,
    updatedAt: now,
  };
}

// Load all data from localStorage
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with one default lesson
      const defaultLesson = createNewLesson();
      const initialData = {
        lessons: [defaultLesson],
        activeLessonId: defaultLesson.id,
      };
      saveData(initialData);
      return initialData;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load data:', error);
    const defaultLesson = createNewLesson();
    return {
      lessons: [defaultLesson],
      activeLessonId: defaultLesson.id,
    };
  }
}

// Save all data to localStorage
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save data:', error);
    return false;
  }
}

// Get a specific lesson by ID
export function getLesson(lessonId) {
  const data = loadData();
  return data.lessons.find(l => l.id === lessonId) || null;
}

// Save/update a specific lesson
export function saveLesson(lesson) {
  const data = loadData();
  const index = data.lessons.findIndex(l => l.id === lesson.id);

  const updatedLesson = {
    ...lesson,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    data.lessons[index] = updatedLesson;
  } else {
    data.lessons.push(updatedLesson);
  }

  saveData(data);
  return updatedLesson;
}

// Delete a lesson
export function deleteLesson(lessonId) {
  const data = loadData();

  // Don't delete if it's the only lesson
  if (data.lessons.length <= 1) {
    return { success: false, reason: 'Cannot delete the only lesson' };
  }

  data.lessons = data.lessons.filter(l => l.id !== lessonId);

  // If we deleted the active lesson, switch to another
  if (data.activeLessonId === lessonId) {
    data.activeLessonId = data.lessons[0].id;
  }

  saveData(data);
  return { success: true, newActiveLessonId: data.activeLessonId };
}

// Set active lesson
export function setActiveLesson(lessonId) {
  const data = loadData();
  if (data.lessons.some(l => l.id === lessonId)) {
    data.activeLessonId = lessonId;
    saveData(data);
    return true;
  }
  return false;
}

// Duplicate a lesson
export function duplicateLesson(lessonId) {
  const data = loadData();
  const original = data.lessons.find(l => l.id === lessonId);

  if (!original) return null;

  const now = Date.now();
  const duplicate = {
    ...original,
    id: generateBlockId(),
    title: `${original.title} (Copy)`,
    blocks: original.blocks.map(b => ({ ...b, id: generateBlockId() })),
    createdAt: now,
    updatedAt: now,
  };

  data.lessons.push(duplicate);
  saveData(data);
  return duplicate;
}

// Search lessons
export function searchLessons(query) {
  const data = loadData();
  const lowerQuery = query.toLowerCase();

  return data.lessons.filter(lesson =>
    lesson.title.toLowerCase().includes(lowerQuery) ||
    lesson.blocks.some(b =>
      b.content?.toLowerCase().includes(lowerQuery)
    )
  );
}

// Get lessons sorted by date
export function getLessonsSorted(sortBy = 'updatedAt', ascending = false) {
  const data = loadData();
  return [...data.lessons].sort((a, b) => {
    const comparison = a[sortBy] - b[sortBy];
    return ascending ? comparison : -comparison;
  });
}

// Export for backup
export function exportAllData() {
  return loadData();
}

// Import from backup
export function importData(data) {
  if (!data.lessons || !Array.isArray(data.lessons)) {
    throw new Error('Invalid data format');
  }
  saveData(data);
  return true;
}

// =============================================================================
// CHAT HISTORY PERSISTENCE (per lesson)
// =============================================================================

// Load chat history for a specific lesson
export function loadChatHistory(lessonId) {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const allChats = JSON.parse(raw);
    return allChats[lessonId] || [];
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

// Save chat history for a specific lesson
export function saveChatHistory(lessonId, messages) {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    const allChats = raw ? JSON.parse(raw) : {};

    // Keep only the last 50 messages per lesson to avoid storage bloat
    allChats[lessonId] = messages.slice(-50);

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));
    return true;
  } catch (error) {
    console.error('Failed to save chat history:', error);
    return false;
  }
}

// Clear chat history for a specific lesson
export function clearChatHistory(lessonId) {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return true;

    const allChats = JSON.parse(raw);
    delete allChats[lessonId];

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));
    return true;
  } catch (error) {
    console.error('Failed to clear chat history:', error);
    return false;
  }
}

// =============================================================================
// AI SETTINGS PERSISTENCE
// =============================================================================

// Default AI settings
const defaultAISettings = {
  selectedModel: 'gpt-oss:20b',
  visionModel: 'qwen3-vl:8b',
  visionEnabled: false,
};

// Load AI settings
export function loadAISettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultAISettings;
    return { ...defaultAISettings, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Failed to load AI settings:', error);
    return defaultAISettings;
  }
}

// Save AI settings
export function saveAISettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Failed to save AI settings:', error);
    return false;
  }
}
