"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import { SlashCommandsMenu, type SlashCommandItem } from "./slash-commands";
import type { ChartEmbedType, JournalBlock, PsychologySnapshot } from "./types";
import { ChartNode } from "./extensions/chart-node";
import { TradeNode, InlineTradeNode } from "./extensions/trade-node";
import { ImageNode } from "./extensions/image-node";
import { CalloutNode } from "./extensions/callout-node";
import { EmbedNode } from "./extensions/embed-node";
import { TradeComparisonNode } from "./extensions/trade-comparison-node";
import { PsychologyNode } from "./extensions/psychology-node";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from "lucide-react";

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// ============================================================================
// Editor Component
// ============================================================================

interface JournalEditorProps {
  initialContent?: JournalBlock[];
  onChange?: (content: JournalBlock[], html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  accountId?: string;
}

export function JournalEditor({
  initialContent,
  onChange,
  placeholder = "Start writing, or press '/' for commands...",
  autoFocus = false,
  className,
  accountId,
}: JournalEditorProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const slashStartPos = useRef<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Use ref for onChange to avoid stale closure in useEditor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Convert initial blocks to HTML
  const getInitialHtml = useCallback(() => {
    if (!initialContent || initialContent.length === 0) {
      return "";
    }
    return blocksToHtml(initialContent);
  }, [initialContent]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: "journal-heading",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "journal-bullet-list",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "journal-ordered-list",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "journal-list-item",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "journal-blockquote",
          },
        },
        codeBlock: false, // Disable default, use CodeBlockLowlight instead
        horizontalRule: {
          HTMLAttributes: {
            class: "journal-hr",
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty",
      }),
      // Task list for to-dos
      TaskList.configure({
        HTMLAttributes: {
          class: "journal-task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "journal-task-item",
        },
      }),
      // Table support
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "journal-table",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "journal-table-row",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "journal-table-header",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "journal-table-cell",
        },
      }),
      // Code block with syntax highlighting
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "journal-code-block",
        },
      }),
      // Link extension
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "journal-link",
        },
      }),
      // Custom nodes
      ChartNode.configure({}),
      TradeNode,
      InlineTradeNode,
      ImageNode,
      CalloutNode,
      EmbedNode,
      TradeComparisonNode,
      PsychologyNode,
    ],
    content: getInitialHtml(),
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "journal-editor-content focus:outline-none min-h-screen",
      },
    },
    onUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      
      // Check if we're inside a code block - if so, don't show slash menu
      const isInCodeBlock = $from.parent.type.name === "codeBlock";
      
      if (isInCodeBlock) {
        if (slashMenuOpen) {
          setSlashMenuOpen(false);
          slashStartPos.current = null;
        }
        // Still notify onChange
        const html = editor.getHTML();
        const blocks = htmlToBlocks(html);
        onChangeRef.current?.(blocks, html);
        return;
      }
      
      // Check for slash command by looking at the current node's text
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const lastSlashIndex = textBefore.lastIndexOf("/");
      
      if (lastSlashIndex !== -1) {
        const textAfterSlash = textBefore.slice(lastSlashIndex + 1);
        // Only show menu if there's no space after slash
        if (!textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")) {
          if (!slashMenuOpen) {
            // Store the document position of the slash
            const nodeStart = from - $from.parentOffset;
            slashStartPos.current = nodeStart + lastSlashIndex;
            // Calculate position
            const coords = editor.view.coordsAtPos(from);
            if (coords) {
              setSlashMenuPosition({
                top: coords.bottom + 8,
                left: coords.left,
              });
            }
            setSlashMenuOpen(true);
          }
          setSlashQuery(textAfterSlash);
        } else {
          setSlashMenuOpen(false);
          slashStartPos.current = null;
        }
      } else {
        setSlashMenuOpen(false);
        slashStartPos.current = null;
      }
      
      // Convert to blocks and notify
      const html = editor.getHTML();
      const blocks = htmlToBlocks(html);
      onChangeRef.current?.(blocks, html);
    },
  });

  // Close slash menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (slashMenuOpen && editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [slashMenuOpen]);

  // Handle slash command selection
  const handleSlashSelect = useCallback(
    (command: SlashCommandItem) => {
      if (!editor || slashStartPos.current === null) return;

      const slashPos = slashStartPos.current;
      const cursorPos = editor.state.selection.from;

      // Close menu and reset state first
      setSlashMenuOpen(false);
      slashStartPos.current = null;
      setSlashQuery("");

      // Delete the slash and query text (from slash position to current cursor)
      editor
        .chain()
        .focus()
        .deleteRange({
          from: slashPos,
          to: cursorPos,
        })
        .run();

      // Execute the command action after deletion
      command.action();
    },
    [editor]
  );

  // Insert block handlers
  const handleInsertBlock = useCallback(
    (type: string, props?: Record<string, unknown>) => {
      if (!editor) return;

      switch (type) {
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "heading1":
          editor.chain().focus().setHeading({ level: 1 }).run();
          break;
        case "heading2":
          editor.chain().focus().setHeading({ level: 2 }).run();
          break;
        case "heading3":
          editor.chain().focus().setHeading({ level: 3 }).run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "numberedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "checkList":
          editor.chain().focus().toggleTaskList().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "callout":
          editor
            .chain()
            .focus()
            .insertContent({
              type: "callout",
              attrs: {
                type: "info",
                emoji: (props?.calloutEmoji as string) || "💡",
              },
              content: [{ type: "paragraph" }],
            })
            .run();
          break;
        case "code":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "divider":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "table":
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        default:
          editor.chain().focus().setParagraph().run();
      }
    },
    [editor]
  );

  // Insert chart
  const handleInsertChart = useCallback(
    (chartType: ChartEmbedType) => {
      if (!editor) return;
      
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "chartEmbed",
            attrs: {
              chartType,
              accountId,
              height: 400, // Increased to accommodate chart Card wrapper
            },
          },
          { type: "paragraph" },
        ])
        .run();
    },
    [editor, accountId]
  );

  // Insert trade
  const handleInsertTrade = useCallback(() => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "tradeEmbed",
          attrs: {
            tradeId: "placeholder",
            symbol: "Select Trade",
            tradeDirection: "long",
            profit: 0,
            pips: 0,
            display: "card",
          },
        },
        { type: "paragraph" },
      ])
      .run();
  }, [editor]);

  // Insert trade comparison
  const handleInsertTradeComparison = useCallback(() => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "tradeComparisonNode",
          attrs: {
            trades: [],
          },
        },
        { type: "paragraph" },
      ])
      .run();
  }, [editor]);

  // Insert image - converts to base64 data URL for persistence
  const handleInsertImage = useCallback(() => {
    if (!editor) return;
    
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Convert to base64 data URL for persistence
        // In production, this should upload to a storage service (S3, etc.)
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const dataUrl = readerEvent.target?.result as string;
          if (dataUrl) {
            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: "journalImage",
                  attrs: { src: dataUrl, alt: file.name },
                },
                { type: "paragraph" },
              ])
              .run();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [editor]);

  // Insert link
  const handleInsertLink = useCallback(() => {
    if (!editor) return;
    
    const url = window.prompt("Enter URL:");
    if (url) {
      // If text is selected, convert it to a link
      if (!editor.state.selection.empty) {
        editor.chain().focus().setLink({ href: url }).run();
      } else {
        // Otherwise, insert the URL as link text
        editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
      }
    }
  }, [editor]);

  // Insert embed (YouTube, Twitter, etc.)
  const handleInsertEmbed = useCallback(() => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "embedNode",
          attrs: {
            url: "placeholder",
            embedType: "generic",
          },
        },
        { type: "paragraph" },
      ])
      .run();
  }, [editor]);

  const handleInsertPsychology = useCallback(() => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "psychologyWidget",
        },
        { type: "paragraph" },
      ])
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("animate-pulse bg-sidebar-accent min-h-screen", className)} />
    );
  }

  return (
    <div ref={editorRef} className={cn("relative journal-editor min-h-screen", className)}>
      {/* Editor Styles */}
      <style jsx global>{`
        .journal-editor-content {
          color: rgba(255, 255, 255, 0.8);
          min-height: 100vh;
          padding-bottom: 50vh;
        }
        
        .journal-editor-content p {
          margin: 0.5rem 0;
          line-height: 1.7;
        }
        
        /* Headings */
        .journal-editor-content h1 {
          font-size: 2.25rem;
          font-weight: 700;
          color: white;
          margin: 2rem 0 1rem 0;
          line-height: 1.2;
        }
        
        .journal-editor-content h2 {
          font-size: 1.75rem;
          font-weight: 600;
          color: white;
          margin: 1.75rem 0 0.75rem 0;
          line-height: 1.3;
        }
        
        .journal-editor-content h3 {
          font-size: 1.375rem;
          font-weight: 600;
          color: white;
          margin: 1.5rem 0 0.5rem 0;
          line-height: 1.4;
        }
        
        /* Lists */
        .journal-bullet-list,
        .journal-ordered-list {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
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
        
        /* Task List - Fixed alignment */
        .journal-task-list {
          list-style: none;
          padding-left: 0;
          margin: 0.75rem 0;
        }
        
        .journal-task-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }
        
        .journal-task-item > label {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          height: 1.7em;
        }
        
        .journal-task-item > div {
          flex: 1;
          line-height: 1.7;
        }
        
        .journal-task-item input[type="checkbox"] {
          appearance: none;
          width: 1.125rem;
          height: 1.125rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
        }
        
        .journal-task-item input[type="checkbox"]:checked {
          background: #14b8a6;
          border-color: #14b8a6;
          background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
        }
        
        .journal-task-item[data-checked="true"] > div {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.4);
        }
        
        /* Blockquote */
        .journal-blockquote {
          border-left: 3px solid #14b8a6;
          padding-left: 1rem;
          margin: 1rem 0;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }
        
        /* Code Block */
        .journal-code-block {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.875rem;
          overflow-x: auto;
        }
        
        .journal-code-block code {
          background: transparent !important;
          padding: 0 !important;
          color: #e2e8f0;
        }
        
        /* Syntax highlighting */
        .journal-code-block .hljs-keyword { color: #c678dd; }
        .journal-code-block .hljs-string { color: #98c379; }
        .journal-code-block .hljs-number { color: #d19a66; }
        .journal-code-block .hljs-comment { color: #5c6370; font-style: italic; }
        .journal-code-block .hljs-function { color: #61afef; }
        .journal-code-block .hljs-variable { color: #e06c75; }
        .journal-code-block .hljs-built_in { color: #e6c07b; }
        
        /* Inline code */
        .journal-editor-content code:not(.journal-code-block code) {
          background: rgba(255, 255, 255, 0.1);
          color: #14b8a6;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 0.875em;
        }
        
        /* Horizontal Rule */
        .journal-hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin: 2rem 0;
        }
        
        /* Table - Fixed styling */
        .journal-table {
          border-collapse: collapse;
          margin: 1rem 0;
          width: 100%;
          table-layout: fixed;
        }
        
        .journal-table-header,
        .journal-table-cell {
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.75rem 1rem;
          text-align: left;
          min-width: 100px;
        }
        
        .journal-table-header {
          background: rgba(255, 255, 255, 0.08);
          font-weight: 600;
          color: white;
        }
        
        .journal-table-cell {
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.8);
        }
        
        .journal-table-row:hover .journal-table-cell {
          background: rgba(255, 255, 255, 0.05);
        }
        
        /* Placeholder */
        .journal-editor-content .is-empty::before {
          content: attr(data-placeholder);
          color: rgba(255, 255, 255, 0.3);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Links */
        .journal-editor-content a {
          color: #14b8a6;
          text-decoration: none;
        }
        
        .journal-editor-content a:hover {
          text-decoration: underline;
        }
        
        /* ProseMirror table selection */
        .journal-editor-content .selectedCell {
          background: rgba(20, 184, 166, 0.2);
        }
        
        .journal-editor-content .column-resize-handle {
          background-color: #14b8a6;
          width: 2px;
          pointer-events: none;
          position: absolute;
          top: 0;
          bottom: 0;
          right: -1px;
        }
      `}</style>

      {/* Bubble Menu for text formatting */}
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 bg-sidebar border border-white/10 p-1 shadow-xl rounded-lg"
      >
        <FormatButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </FormatButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <FormatButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </FormatButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <FormatButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </FormatButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <FormatButton
          onClick={() => editor.chain().focus().setLink({ href: window.prompt("Enter URL:") || "" }).run()}
          isActive={editor.isActive("link")}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </FormatButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <FormatButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </FormatButton>
        <FormatButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </FormatButton>
      </BubbleMenu>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Slash Commands Menu */}
      <SlashCommandsMenu
        isOpen={slashMenuOpen}
        position={slashMenuPosition}
        query={slashQuery}
        onSelect={handleSlashSelect}
        onClose={() => setSlashMenuOpen(false)}
        onInsertBlock={handleInsertBlock}
        onInsertChart={handleInsertChart}
        onInsertTrade={handleInsertTrade}
        onInsertTradeComparison={handleInsertTradeComparison}
        onInsertImage={handleInsertImage}
        onInsertLink={handleInsertLink}
        onInsertEmbed={handleInsertEmbed}
        onInsertPsychology={handleInsertPsychology}
      />
    </div>
  );
}

// ============================================================================
// Format Button
// ============================================================================

interface FormatButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}

function FormatButton({ onClick, isActive, title, children }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Conversion Utilities
// ============================================================================

function blocksToHtml(blocks: JournalBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<p>${block.content}</p>`;
        case "heading1":
          return `<h1>${block.content}</h1>`;
        case "heading2":
          return `<h2>${block.content}</h2>`;
        case "heading3":
          return `<h3>${block.content}</h3>`;
        case "bulletList":
          return `<ul class="journal-bullet-list"><li>${block.content}</li></ul>`;
        case "numberedList":
          return `<ol class="journal-ordered-list"><li>${block.content}</li></ol>`;
        case "checkList":
          return `<ul data-type="taskList" class="journal-task-list"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div>${block.content}</div></li></ul>`;
        case "quote":
          return `<blockquote class="journal-blockquote">${block.content}</blockquote>`;
        case "callout":
          return `<div data-callout data-type="${block.props?.calloutType || 'info'}">${block.content}</div>`;
        case "code":
          return `<pre class="journal-code-block"><code>${block.content}</code></pre>`;
        case "divider":
          return '<hr class="journal-hr" />';
        case "table":
          return `<table class="journal-table"><tbody>${block.content}</tbody></table>`;
        case "image":
          return `<figure data-journal-image><img src="${block.props?.imageUrl || ""}" alt="${block.props?.imageAlt || ""}" /></figure>`;
        case "chart":
          return `<div data-chart-embed data-chart-type="${block.props?.chartType || ""}" data-account-id="${block.props?.accountId || ""}"></div>`;
        case "trade":
          const tradeProps = block.props;
          return `<div data-trade-embed data-trade-id="${tradeProps?.tradeId || ""}" data-symbol="${tradeProps?.symbol || ""}" data-direction="${tradeProps?.tradeDirection || "long"}" data-profit="${tradeProps?.profit || 0}" data-pips="${tradeProps?.pips || 0}" data-close-time="${tradeProps?.closeTime || ""}" data-outcome="${tradeProps?.outcome || ""}" data-display="${tradeProps?.tradeDisplay || "card"}"></div>`;
        case "tradeComparison":
          const comparisonTrades = block.props?.trades || [];
          return `<div data-trade-comparison data-trades="${encodeURIComponent(JSON.stringify(comparisonTrades))}"></div>`;
        case "psychology":
          const psych = block.props?.psychologyData;
          if (psych) {
            return `<div data-psychology-widget data-mood="${psych.mood}" data-confidence="${psych.confidence}" data-energy="${psych.energy}" data-focus="${psych.focus}" data-fear="${psych.fear}" data-greed="${psych.greed}" data-emotional-state="${psych.emotionalState}" data-trading-environment="${psych.tradingEnvironment || ''}" data-sleep-quality="${psych.sleepQuality || 5}" data-distractions="${psych.distractions ? 'true' : 'false'}" data-market-condition="${psych.marketCondition || ''}" data-notes="${encodeURIComponent(psych.notes || '')}"></div>`;
          }
          return '<div data-psychology-widget></div>';
        default:
          return `<p>${block.content}</p>`;
      }
    })
    .join("");
}

function htmlToBlocks(html: string): JournalBlock[] {
  const blocks: JournalBlock[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nodes = doc.body.childNodes;

  nodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const id = crypto.randomUUID();

    // Check for custom embed nodes
    if (element.hasAttribute("data-chart-embed")) {
      const chartType = element.getAttribute("data-chart-type");
      const accountId = element.getAttribute("data-account-id");
      // Only add chart block if we have a valid chart type
      if (chartType && chartType !== "") {
        blocks.push({
          id,
          type: "chart",
          content: "",
          props: {
            chartType: chartType as ChartEmbedType,
            accountId: accountId && accountId !== "" ? accountId : undefined,
          },
        });
      }
      return;
    }

    if (element.hasAttribute("data-trade-embed")) {
      const tradeId = element.getAttribute("data-trade-id");
      const symbol = element.getAttribute("data-symbol");
      const direction = element.getAttribute("data-direction") as 'long' | 'short' | null;
      const profit = element.getAttribute("data-profit");
      const pips = element.getAttribute("data-pips");
      const closeTime = element.getAttribute("data-close-time");
      const outcome = element.getAttribute("data-outcome");
      const display = element.getAttribute("data-display") as 'card' | 'inline' | 'detailed' | null;
      
      blocks.push({
        id,
        type: "trade",
        content: "",
        props: {
          tradeId: tradeId && tradeId !== "" && tradeId !== "placeholder" ? tradeId : undefined,
          symbol: symbol && symbol !== "" ? symbol : undefined,
          tradeDirection: direction || undefined,
          profit: profit ? parseFloat(profit) : undefined,
          pips: pips ? parseFloat(pips) : undefined,
          closeTime: closeTime && closeTime !== "" ? closeTime : null,
          outcome: outcome && outcome !== "" ? outcome : null,
          tradeDisplay: display || "card",
        },
      });
      return;
    }

    if (element.hasAttribute("data-trade-comparison")) {
      const tradesStr = element.getAttribute("data-trades") || "[]";
      let trades: Array<{
        id: string;
        symbol?: string | null;
        tradeDirection?: 'long' | 'short';
        profit?: number | null;
        pips?: number | null;
        close?: string | null;
        outcome?: string | null;
      }> = [];
      try {
        trades = JSON.parse(decodeURIComponent(tradesStr));
      } catch {
        try {
          trades = JSON.parse(tradesStr);
        } catch {
          trades = [];
        }
      }
      blocks.push({
        id,
        type: "tradeComparison",
        content: "",
        props: {
          trades: trades || [],
        },
      });
      return;
    }

    if (element.hasAttribute("data-journal-image")) {
      // Get src from data attribute first, then from img element
      let src = element.getAttribute("data-src") || "";
      if (!src) {
        const img = element.querySelector("img");
        src = img?.getAttribute("src") || "";
      }
      const alt = element.getAttribute("data-alt") || element.querySelector("img")?.getAttribute("alt") || "";
      
      // Only save images that are data URLs or proper URLs (not blob URLs)
      if (src && (src.startsWith("data:") || (src.startsWith("http") && !src.startsWith("blob:")))) {
        blocks.push({
          id,
          type: "image",
          content: "",
          props: {
            imageUrl: src,
            imageAlt: alt,
          },
        });
      }
      return;
    }

    if (element.hasAttribute("data-callout")) {
      const calloutType = element.getAttribute("data-callout-type") as "info" | "warning" | "success" | "error" | "note" | null;
      blocks.push({
        id,
        type: "callout",
        content: element.innerHTML,
        props: {
          calloutType: calloutType || "info",
        },
      });
      return;
    }

    if (element.hasAttribute("data-psychology-widget")) {
      blocks.push({
        id,
        type: "psychology",
        content: "",
        props: {
          psychologyData: {
            mood: parseInt(element.getAttribute("data-mood") || "5"),
            confidence: parseInt(element.getAttribute("data-confidence") || "5"),
            energy: parseInt(element.getAttribute("data-energy") || "5"),
            focus: parseInt(element.getAttribute("data-focus") || "5"),
            fear: parseInt(element.getAttribute("data-fear") || "5"),
            greed: parseInt(element.getAttribute("data-greed") || "5"),
            emotionalState: (element.getAttribute("data-emotional-state") || "neutral") as PsychologySnapshot["emotionalState"],
            tradingEnvironment: (element.getAttribute("data-trading-environment") || undefined) as PsychologySnapshot["tradingEnvironment"],
            sleepQuality: parseInt(element.getAttribute("data-sleep-quality") || "5"),
            distractions: element.getAttribute("data-distractions") === "true",
            marketCondition: (element.getAttribute("data-market-condition") || undefined) as PsychologySnapshot["marketCondition"],
            notes: decodeURIComponent(element.getAttribute("data-notes") || ""),
          },
        },
      });
      return;
    }

    // Task list
    if (element.getAttribute("data-type") === "taskList") {
      blocks.push({
        id,
        type: "checkList",
        content: element.innerHTML,
      });
      return;
    }

    switch (tagName) {
      case "h1":
        blocks.push({ id, type: "heading1", content: element.innerHTML });
        break;
      case "h2":
        blocks.push({ id, type: "heading2", content: element.innerHTML });
        break;
      case "h3":
        blocks.push({ id, type: "heading3", content: element.innerHTML });
        break;
      case "ul":
        if (element.classList.contains("journal-task-list") || element.getAttribute("data-type") === "taskList") {
          blocks.push({ id, type: "checkList", content: element.innerHTML });
        } else {
          blocks.push({ id, type: "bulletList", content: element.innerHTML });
        }
        break;
      case "ol":
        blocks.push({ id, type: "numberedList", content: element.innerHTML });
        break;
      case "blockquote":
        blocks.push({ id, type: "quote", content: element.innerHTML });
        break;
      case "pre":
        blocks.push({ id, type: "code", content: element.textContent || "" });
        break;
      case "hr":
        blocks.push({ id, type: "divider", content: "" });
        break;
      case "table":
        blocks.push({ id, type: "table", content: element.innerHTML });
        break;
      case "figure":
        if (element.hasAttribute("data-journal-image")) {
          const img = element.querySelector("img");
          blocks.push({
            id,
            type: "image",
            content: "",
            props: {
              imageUrl: img?.getAttribute("src") || "",
              imageAlt: img?.getAttribute("alt") || "",
            },
          });
        }
        break;
      default:
        if (element.innerHTML.trim()) {
          blocks.push({ id, type: "paragraph", content: element.innerHTML });
        }
    }
  });

  return blocks;
}

// Export the editor ref type for external control
export type { Editor };
