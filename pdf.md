# PDF Creation - PyCourse Architect

## Overview

The application uses a **browser-native print-to-PDF approach** rather than programmatic PDF generation with external libraries. This keeps the implementation lightweight and dependency-free.

## Libraries & Dependencies

**Status:** No external PDF libraries installed

The app does NOT use dedicated PDF libraries like PDFKit, Puppeteer, jsPDF, pdf-lib, or pdfmake. Instead, it leverages the browser's built-in print functionality.

## Key Files

| File | Purpose |
|------|---------|
| `components/CourseExportView.tsx` | Main PDF export view component (lines 185-495) |
| `App.tsx` | Export button and mode toggle (lines 902-908, 823-825) |
| `src/index.css` | Print-specific CSS styles (lines 63-88) |

## PDF Export Flow

```
User clicks "Export PDF" button (App.tsx:902-908)
    ↓
App.tsx: setIsExportMode(true) (line 180)
    ↓
CourseExportView component renders (App.tsx:823-825)
    ↓
Shows formatted course content with toolbar
    ↓
User clicks "Print / Save PDF" button (CourseExportView.tsx:261-268)
    ↓
handlePrint() → window.print() (CourseExportView.tsx:223-225)
    ↓
Browser's native print dialog opens
    ↓
User selects "Save as PDF"
    ↓
PDF file downloaded with course content
```

## Implementation Details

### Export Mode Toggle (App.tsx:823-825)

```typescript
if (isExportMode) {
    return <CourseExportView course={course} onClose={() => setIsExportMode(false)} />;
}
```

### Export Button (App.tsx:902-908)

```typescript
<button
  onClick={() => setIsExportMode(true)}
  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-300"
  title="View as PDF"
>
  <Printer className="w-4 h-4" />
  <span className="hidden sm:inline">Export PDF</span>
</button>
```

### Print Handler (CourseExportView.tsx:223-225)

```typescript
const handlePrint = () => {
  window.print();
};
```

### Export Toolbar (CourseExportView.tsx:251-269)

```typescript
<div className="no-print sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex justify-between items-center shadow-sm">
  <button
    onClick={onClose}
    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
  >
    <ArrowLeft className="w-4 h-4" />
    Back to Editor
  </button>
  <div className="flex items-center gap-4">
    <span className="text-sm text-slate-500 hidden md:inline">Pro Tip: Use browser print dialog to "Save as PDF"</span>
    <button
      onClick={handlePrint}
      className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 shadow-sm transition-all font-medium"
    >
      <Printer className="w-4 h-4" />
      Print / Save PDF
    </button>
  </div>
</div>
```

## PDF Document Structure

The `CourseExportView` component generates a formatted document with:

1. **Cover Page** (lines 274-294) - Gradient design with course title
2. **Table of Contents** (lines 296-319) - Module/lesson structure
3. **Content Sections** (lines 321-471) - All course content with proper pagination
4. **Answer Key** (lines 473-489) - Test question answers

### Content Rendering Features

- Text content with markdown parsing (headers, lists, tables, code blocks)
- Code examples with syntax highlighting
- Images and infographics
- Practice exercises
- Micro-learnings with title/code/image support
- Test questions with answer key

## Print CSS Configuration (src/index.css:63-88)

```css
@media print {
  @page {
    margin: 2cm;
  }
  body {
    background-color: white;
    background-image: none;
    color: black;
  }
  .no-print {
    display: none !important;
  }
  .print-break-after {
    break-after: page;
  }
  .print-break-inside-avoid {
    break-inside: avoid;
  }
  /* Ensure code blocks print with background */
  pre {
    background-color: #f1f5f9 !important;
    color: #0f172a !important;
    border: 1px solid #e2e8f0;
    white-space: pre-wrap;
  }
}
```

## Tailwind Print Utility Classes

| Class | Purpose |
|-------|---------|
| `no-print` | Hides toolbar and navigation |
| `print:hidden` | Hides elements in print (decorative backgrounds) |
| `print:block` | Shows elements only in print |
| `print-break-after` | Page break after element (cover, TOC, modules) |
| `print-break-inside-avoid` | Prevents breaking content inside (topics, tests) |
| `print:bg-white` | Print-specific background |
| `print:bg-transparent` | Print-specific transparent background |
| `print:border-*` | Print-specific borders |
| `print:p-0` | Print-specific padding |
| `print:shadow-none` | Removes shadows for print |
| `print:text-black` | Print text color override |

## Summary

| Aspect | Details |
|--------|---------|
| **Approach** | Browser-native print-to-PDF |
| **External Libraries** | None |
| **Primary Component** | `components/CourseExportView.tsx` |
| **Trigger** | "Export PDF" button in navbar |
| **Method** | `window.print()` API |
| **Styling** | CSS media queries + Tailwind print utilities |
| **Features** | Cover page, TOC, formatted content, answer key |

This implementation is lightweight, dependency-free, and leverages browser capabilities for PDF generation, making it simple, reliable, and requiring no backend infrastructure.
