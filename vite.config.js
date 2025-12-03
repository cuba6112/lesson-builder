import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
  build: {
    // Large vendor chunks (mermaid, cytoscape, pdfjs) are lazy-loaded on demand
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Security
          if (id.includes('node_modules/dompurify')) {
            return 'vendor-security';
          }
          // D3 core (shared by mermaid and other visualizations)
          if (id.includes('node_modules/d3-')) {
            return 'vendor-d3';
          }
          // Mermaid diagram library
          if (id.includes('node_modules/mermaid')) {
            return 'vendor-mermaid';
          }
          // Dagre layout algorithm
          if (id.includes('node_modules/dagre')) {
            return 'vendor-dagre';
          }
          // Cytoscape core
          if (id.includes('node_modules/cytoscape') && !id.includes('cose-bilkent')) {
            return 'vendor-cytoscape';
          }
          // Cytoscape layout plugins
          if (id.includes('cose-bilkent')) {
            return 'vendor-cytoscape-layout';
          }
          // PDF export (lazy loaded)
          if (id.includes('node_modules/html2pdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/jspdf')) {
            return 'vendor-pdf';
          }
          // KaTeX for math rendering
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex';
          }
          // DnD kit
          if (id.includes('node_modules/@dnd-kit')) {
            return 'vendor-dnd';
          }
          // Marked and code highlighting
          if (id.includes('node_modules/marked') || id.includes('node_modules/prism') || id.includes('node_modules/highlight')) {
            return 'vendor-markdown';
          }
          // React-live for interactive code
          if (id.includes('node_modules/react-live') || id.includes('node_modules/prism-react-renderer')) {
            return 'vendor-react-live';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // PDF.js for PDF reading
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdfjs';
          }
        },
      },
    },
  },
})
