"use client";

export function JournalEditorStyles() {
  return (
    <style jsx global>{`
      .journal-editor-content {
        color: rgba(255, 255, 255, 0.8);
        min-height: 100vh;
        padding-bottom: 50vh;
      }

      .journal-editor[data-compact="true"] .journal-editor-content {
        min-height: 26rem;
        padding-bottom: 10rem;
      }

      .journal-editor-content p {
        margin: 0.5rem 0;
        line-height: 1.7;
      }

      .journal-editor-content h1 {
        margin: 2rem 0 1rem 0;
        color: white;
        font-size: 2.25rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .journal-editor-content h2 {
        margin: 1.75rem 0 0.75rem 0;
        color: white;
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 1.3;
      }

      .journal-editor-content h3 {
        margin: 1.5rem 0 0.5rem 0;
        color: white;
        font-size: 1.375rem;
        font-weight: 600;
        line-height: 1.4;
      }

      .journal-bullet-list,
      .journal-ordered-list {
        margin: 0.75rem 0;
        padding-left: 1.5rem;
      }

      .journal-bullet-list {
        list-style-type: disc;
      }

      .journal-ordered-list {
        list-style-type: decimal;
      }

      .journal-list-item {
        margin: 0.375rem 0;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.6;
      }

      .journal-list-item::marker {
        color: rgba(255, 255, 255, 0.4);
      }

      .journal-task-list {
        margin: 0.75rem 0;
        padding-left: 0;
        list-style: none;
      }

      .journal-task-item {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0.5rem 0;
      }

      .journal-task-item > label {
        display: flex;
        height: 1.7em;
        flex-shrink: 0;
        align-items: center;
      }

      .journal-task-item > div {
        flex: 1;
        line-height: 1.7;
      }

      .journal-task-item input[type="checkbox"] {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
        appearance: none;
        cursor: pointer;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        background: transparent;
      }

      .journal-task-item input[type="checkbox"]:checked {
        border-color: #14b8a6;
        background: #14b8a6;
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
      }

      .journal-task-item[data-checked="true"] > div {
        color: rgba(255, 255, 255, 0.4);
        text-decoration: line-through;
      }

      .journal-blockquote {
        margin: 1rem 0;
        border-left: 3px solid #14b8a6;
        padding-left: 1rem;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
      }

      .journal-code-block {
        margin: 1rem 0;
        overflow-x: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.5);
        padding: 1rem;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
          monospace;
        font-size: 0.875rem;
      }

      .journal-code-block code {
        background: transparent !important;
        padding: 0 !important;
        color: #e2e8f0;
      }

      .journal-code-block .hljs-keyword {
        color: #c678dd;
      }

      .journal-code-block .hljs-string {
        color: #98c379;
      }

      .journal-code-block .hljs-number {
        color: #d19a66;
      }

      .journal-code-block .hljs-comment {
        color: #5c6370;
        font-style: italic;
      }

      .journal-code-block .hljs-function {
        color: #61afef;
      }

      .journal-code-block .hljs-variable {
        color: #e06c75;
      }

      .journal-code-block .hljs-built_in {
        color: #e6c07b;
      }

      .journal-editor-content code:not(.journal-code-block code) {
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.125rem 0.375rem;
        color: #14b8a6;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.875em;
      }

      .journal-hr {
        margin: 2rem 0;
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .journal-table {
        margin: 1rem 0;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
      }

      .journal-table-header,
      .journal-table-cell {
        min-width: 100px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.75rem 1rem;
        text-align: left;
      }

      .journal-table-header {
        background: rgba(255, 255, 255, 0.08);
        color: white;
        font-weight: 600;
      }

      .journal-table-cell {
        background: rgba(255, 255, 255, 0.02);
        color: rgba(255, 255, 255, 0.8);
      }

      .journal-table-row:hover .journal-table-cell {
        background: rgba(255, 255, 255, 0.05);
      }

      .journal-editor-content .is-empty::before {
        height: 0;
        float: left;
        color: rgba(255, 255, 255, 0.3);
        content: attr(data-placeholder);
        pointer-events: none;
      }

      .journal-editor-content a {
        color: #14b8a6;
        text-decoration: none;
      }

      .journal-editor-content a:hover {
        text-decoration: underline;
      }

      .journal-editor-content .selectedCell {
        background: rgba(20, 184, 166, 0.2);
      }

      .journal-editor-content .column-resize-handle {
        position: absolute;
        top: 0;
        right: -1px;
        bottom: 0;
        width: 2px;
        background-color: #14b8a6;
        pointer-events: none;
      }
    `}</style>
  );
}
