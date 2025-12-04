// Image Library Service
// Manages the static image library with manifest-based metadata

const MANIFEST_URL = '/library/manifest.json';

class ImageLibraryService {
  constructor() {
    this.manifest = null;
    this.images = [];
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Load the manifest from the public folder
   * @returns {Promise<object>} The manifest object
   */
  async loadManifest() {
    if (this.loaded) return this.manifest;
    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return this.manifest;
    }

    this.loading = true;
    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }
      this.manifest = await response.json();
      this.images = this.manifest.images || [];
      this.loaded = true;
      return this.manifest;
    } catch (error) {
      console.error('Error loading image library manifest:', error);
      this.manifest = { version: 1, images: [] };
      this.images = [];
      this.loaded = true;
      return this.manifest;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get all images in the library
   * @returns {Promise<Array>} Array of image objects
   */
  async getImages() {
    await this.loadManifest();
    return this.images;
  }

  /**
   * Get image by ID
   * @param {string} id - Image ID
   * @returns {Promise<object|null>} Image object or null
   */
  async getImageById(id) {
    await this.loadManifest();
    return this.images.find(img => img.id === id) || null;
  }

  /**
   * Search images by query string
   * Matches against name, description, and tags
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching images sorted by relevance
   */
  async searchImages(query) {
    await this.loadManifest();

    if (!query || query.trim() === '') {
      return this.images;
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    const scored = this.images.map(img => {
      let score = 0;
      const name = (img.name || '').toLowerCase();
      const description = (img.description || '').toLowerCase();
      const tags = (img.tags || []).map(t => t.toLowerCase());
      const category = (img.category || '').toLowerCase();

      for (const term of searchTerms) {
        // Exact matches score higher
        if (name === term) score += 10;
        if (tags.includes(term)) score += 8;
        if (category === term) score += 6;

        // Partial matches
        if (name.includes(term)) score += 5;
        if (tags.some(t => t.includes(term))) score += 4;
        if (description.includes(term)) score += 3;
        if (category.includes(term)) score += 2;
      }

      return { ...img, _score: score };
    });

    return scored
      .filter(img => img._score > 0)
      .sort((a, b) => b._score - a._score)
      .map(img => {
        // eslint-disable-next-line no-unused-vars
        const { _score, ...rest } = img;
        return rest;
      });
  }

  /**
   * Get images by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Images in the category
   */
  async getImagesByCategory(category) {
    await this.loadManifest();
    return this.images.filter(img => img.category === category);
  }

  /**
   * Get all unique categories
   * @returns {Promise<Array>} Array of category names
   */
  async getCategories() {
    await this.loadManifest();
    const categories = new Set(this.images.map(img => img.category).filter(Boolean));
    return Array.from(categories).sort();
  }

  /**
   * Get the full URL path for an image
   * @param {string} path - Relative path from manifest
   * @returns {string} Full URL path
   */
  getImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `/library/${path}`;
  }

  /**
   * Force reload the manifest
   */
  async reload() {
    this.loaded = false;
    this.loading = false;
    return this.loadManifest();
  }

  /**
   * Get library stats
   * @returns {Promise<object>} Stats object
   */
  async getStats() {
    await this.loadManifest();
    const categories = await this.getCategories();
    return {
      totalImages: this.images.length,
      categories: categories.length,
      lastUpdated: this.manifest.lastUpdated,
      version: this.manifest.version,
    };
  }
}

// Export singleton
export const imageLibrary = new ImageLibraryService();

// Export class for testing
export { ImageLibraryService };
