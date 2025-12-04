import React, { useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { saveFile } from '../services/fileSaver';

/**
 * LessonExportView - PDF export using html2canvas + jsPDF
 *
 * Generates a PDF by capturing the rendered content as images.
 * Note: Uses inline styles with hex colors to avoid oklch() color function
 * which is not supported by html2canvas.
 */

// Color palette using hex values (html2canvas compatible)
const colors = {
  // Grays
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  // Blues
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue800: '#1e40af',
  blue900: '#1e3a8a',
  // Greens
  green50: '#f0fdf4',
  green300: '#86efac',
  green800: '#166534',
  // Purples
  purple50: '#faf5ff',
  purple200: '#e9d5ff',
  purple600: '#9333ea',
  // Teals
  teal50: '#f0fdfa',
  teal200: '#99f6e4',
  teal600: '#0d9488',
  // Indigo
  indigo50: '#eef2ff',
  indigo200: '#c7d2fe',
  indigo600: '#4f46e5',
  // Reds
  red50: '#fef2f2',
  red200: '#fecaca',
  red800: '#991b1b',
  // Amber
  amber50: '#fffbeb',
  amber200: '#fde68a',
  amber800: '#92400e',
};

export default function LessonExportView({ lesson, onClose }) {
  const { title, icon, blocks } = lesson;
  const contentRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    setExportStatus('Preparing document...');

    try {
      // Dynamic imports for code splitting
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      setExportStatus('Rendering content...');

      // Capture the content as canvas
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      setExportStatus('Generating PDF...');

      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      // Add remaining pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      // Generate filename
      const filename = `${(title || 'lesson').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;

      setExportStatus('Saving file...');

      const pdfBuffer = pdf.output('arraybuffer');
      await saveFile({
        data: pdfBuffer,
        filename,
        mimeType: 'application/pdf',
        binary: true
      });

      setExportStatus('Done!');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportStatus(`Error: ${error.message}`);
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  // Render a single block for PDF - using inline styles to avoid oklch() color issues
  const renderBlock = (block) => {
    switch (block.type) {
      case 'heading':
        return (
          <h2
            key={block.id}
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: colors.gray900,
              marginTop: '2rem',
              marginBottom: '1rem'
            }}
          >
            {block.content || 'Untitled Section'}
          </h2>
        );

      case 'text':
        return (
          <div key={block.id} style={{ color: colors.gray700, lineHeight: 1.7, marginBottom: '1rem' }}>
            {block.content?.split('\n\n').map((para, i) => (
              <p key={i} style={{ marginBottom: '0.75rem' }}>{para}</p>
            ))}
          </div>
        );

      case 'image':
        return (
          <figure key={block.id} style={{ margin: '1.5rem 0', textAlign: 'center' }}>
            <img
              src={block.content}
              alt={block.caption || 'Lesson image'}
              style={{ maxWidth: '100%', height: 'auto', margin: '0 auto', borderRadius: '0.5rem', maxHeight: '400px' }}
              crossOrigin="anonymous"
            />
            {block.caption && (
              <figcaption style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: colors.gray500, fontStyle: 'italic' }}>
                {block.caption}
              </figcaption>
            )}
          </figure>
        );

      case 'video':
        return (
          <div key={block.id} style={{ margin: '1.5rem 0', padding: '1rem', backgroundColor: colors.gray100, borderRadius: '0.5rem' }}>
            <p style={{ color: colors.gray700 }}>
              <span style={{ marginRight: '0.5rem' }}>🎬</span>
              <strong>Video:</strong>{' '}
              <span style={{ color: colors.blue600, textDecoration: 'underline' }}>
                {block.content}
              </span>
            </p>
          </div>
        );

      case 'quiz':
        return (
          <div key={block.id} style={{
            margin: '1.5rem 0',
            padding: '1.25rem',
            backgroundColor: colors.blue50,
            borderLeft: `4px solid ${colors.blue500}`,
            borderRadius: '0 0.5rem 0.5rem 0'
          }}>
            <p style={{ fontWeight: 600, color: colors.blue900, marginBottom: '1rem' }}>
              ❓ {block.content || 'Quiz Question'}
            </p>
            {block.options?.map((option, i) => {
              const letter = String.fromCharCode(65 + i);
              const isCorrect = i === block.correctAnswer;
              return (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${isCorrect ? colors.green300 : colors.gray200}`,
                    backgroundColor: isCorrect ? colors.green50 : colors.white,
                    color: isCorrect ? colors.green800 : colors.gray700
                  }}
                >
                  <strong>{letter})</strong> {option}
                  {isCorrect && <span style={{ marginLeft: '0.5rem' }}>✓</span>}
                </div>
              );
            })}
          </div>
        );

      case 'html':
        return (
          <div
            key={block.id}
            style={{ margin: '1rem 0', color: colors.gray700, lineHeight: 1.75 }}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(block.content || '', {
                ALLOWED_TAGS: [
                  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                  'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'br', 'hr', 'pre', 'code',
                  'blockquote', 'figure', 'figcaption'
                ],
                ALLOWED_ATTR: ['style', 'class', 'href', 'src', 'alt', 'title', 'target', 'rel'],
              })
            }}
          />
        );

      case 'code':
        return (
          <div key={block.id} style={{ margin: '1.5rem 0', borderRadius: '0.5rem', overflow: 'hidden', border: `1px solid ${colors.gray200}` }}>
            {block.filename && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: colors.gray100, borderBottom: `1px solid ${colors.gray200}`, fontSize: '0.875rem', fontFamily: 'monospace', color: colors.gray600 }}>
                📄 {block.filename}
              </div>
            )}
            <pre style={{ padding: '1rem', backgroundColor: colors.gray100, color: colors.gray900, fontSize: '0.875rem', overflowX: 'auto', margin: 0 }}>
              <code>{block.content || ''}</code>
            </pre>
            {block.language && (
              <div style={{ padding: '0.25rem 1rem', backgroundColor: colors.gray50, fontSize: '0.75rem', color: colors.gray500, textAlign: 'right', borderTop: `1px solid ${colors.gray200}` }}>
                {block.language}
              </div>
            )}
          </div>
        );

      case 'react':
        return (
          <div key={block.id} style={{ margin: '1.5rem 0', padding: '1rem', backgroundColor: colors.purple50, border: `1px solid ${colors.purple200}`, borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: colors.purple600, fontWeight: 500, marginBottom: '0.5rem' }}>⚛️ Interactive React Component</p>
            <pre style={{ padding: '0.75rem', backgroundColor: colors.gray100, color: colors.gray900, fontSize: '0.875rem', borderRadius: '0.25rem', overflowX: 'auto', margin: 0 }}>
              <code>{block.content || ''}</code>
            </pre>
          </div>
        );

      case 'mermaid':
        return (
          <div key={block.id} style={{ margin: '1.5rem 0', padding: '1rem', backgroundColor: colors.teal50, border: `1px solid ${colors.teal200}`, borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: colors.teal600, fontWeight: 500, marginBottom: '0.5rem' }}>📊 Mermaid Diagram</p>
            <pre style={{ padding: '0.75rem', backgroundColor: colors.gray100, color: colors.gray900, fontSize: '0.875rem', borderRadius: '0.25rem', overflowX: 'auto', margin: 0 }}>
              <code>{block.content || ''}</code>
            </pre>
          </div>
        );

      case 'math':
        return (
          <div key={block.id} style={{ margin: '1.5rem 0', padding: '1rem', backgroundColor: colors.indigo50, border: `1px solid ${colors.indigo200}`, borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: colors.indigo600, fontWeight: 500, marginBottom: '0.5rem' }}>📐 Math Formula</p>
            <pre style={{ padding: '0.75rem', backgroundColor: colors.gray100, color: colors.gray900, fontSize: '0.875rem', borderRadius: '0.25rem', overflowX: 'auto', margin: 0 }}>
              <code>{block.content || ''}</code>
            </pre>
          </div>
        );

      default:
        return (
          <p key={block.id} style={{ color: colors.gray700, marginBottom: '1rem' }}>
            {block.content || ''}
          </p>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.gray100 }}>
      {/* Toolbar - NOT captured by html2canvas, can use Tailwind */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Editor
        </button>
        <div className="flex items-center gap-4">
          {exportStatus && (
            <span className="text-sm text-gray-500">
              {exportStatus}
            </span>
          )}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 shadow-sm transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={18} />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* PDF Content - this is what gets captured - ALL INLINE STYLES to avoid oklch() */}
      <div
        ref={contentRef}
        style={{
          maxWidth: '48rem',
          margin: '0 auto',
          backgroundColor: colors.white,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Cover Page - using solid color for better PDF compatibility */}
        <div style={{ padding: '4rem 3rem', textAlign: 'center', backgroundColor: colors.indigo600 }}>
          <div style={{ fontSize: '3.75rem', marginBottom: '1.5rem' }}>{icon || '📚'}</div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: colors.white, marginBottom: '1rem' }}>
            {title || 'Untitled Lesson'}
          </h1>
          <p style={{ color: colors.blue100, fontSize: '1.125rem' }}>
            Created with Lesson Builder
          </p>
          <p style={{ color: colors.blue200, fontSize: '0.875rem', marginTop: '1rem' }}>
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Table of Contents */}
        <div style={{ padding: '2.5rem 3rem', borderBottom: `1px solid ${colors.gray200}` }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: colors.gray900,
            marginBottom: '1.5rem',
            paddingBottom: '0.5rem',
            borderBottom: `2px solid ${colors.blue500}`
          }}>
            Table of Contents
          </h2>
          <nav>
            {blocks
              .filter(b => b.type === 'heading')
              .map((block, i) => (
                <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: colors.gray700, marginBottom: '0.5rem' }}>
                  <span style={{ color: colors.blue500, fontFamily: 'monospace', fontSize: '0.875rem' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{block.content || 'Untitled Section'}</span>
                </div>
              ))}
            {blocks.filter(b => b.type === 'heading').length === 0 && (
              <p style={{ color: colors.gray500, fontStyle: 'italic' }}>No sections defined</p>
            )}
          </nav>
        </div>

        {/* Main Content */}
        <div style={{ padding: '2.5rem 3rem' }}>
          {blocks.map((block) => renderBlock(block))}
        </div>

        {/* Footer */}
        <div style={{ padding: '2rem 3rem', borderTop: `1px solid ${colors.gray200}`, textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: colors.gray400 }}>
            Created with Lesson Builder • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
