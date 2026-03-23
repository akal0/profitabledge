"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import { common, createLowlight } from "lowlight";

import { cn } from "@/lib/utils";
import {
  blocksToHtml,
  htmlToBlocks,
} from "@/components/journal/editor/serialization";
import { JournalEditorBubbleMenu } from "@/components/journal/editor/journal-editor-bubble-menu";
import { JournalAICaptureDialog } from "@/components/journal/editor/journal-ai-capture-dialog";
import { JournalEditorStyles } from "@/components/journal/editor/journal-editor-styles";
import { useJournalEditorInsertActions } from "@/components/journal/editor/use-journal-editor-insert-actions";
import { useJournalSlashMenu } from "@/components/journal/editor/use-journal-slash-menu";
import { CalloutNode } from "@/components/journal/extensions/callout-node";
import { ChartNode } from "@/components/journal/extensions/chart-node";
import { EmbedNode } from "@/components/journal/extensions/embed-node";
import { ImageNode } from "@/components/journal/extensions/image-node";
import { PsychologyNode } from "@/components/journal/extensions/psychology-node";
import { TradeComparisonNode } from "@/components/journal/extensions/trade-comparison-node";
import { VideoNode } from "@/components/journal/extensions/video-node";
import type { JournalAICaptureResult } from "@/components/journal/ai-capture-types";
import { SlashCommandsMenu } from "./slash-commands";
import type { JournalBlock } from "./types";
import { TradeNode, InlineTradeNode } from "./extensions/trade-node";

const lowlight = createLowlight(common);

interface JournalEditorProps {
  initialContent?: JournalBlock[];
  onChange?: (content: JournalBlock[], html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
  accountId?: string;
  onApplyAICapture?: (
    capture: JournalAICaptureResult,
    nextContent?: JournalBlock[]
  ) => void;
}

export interface JournalEditorSnapshot {
  content: JournalBlock[];
  html: string;
}

export interface JournalEditorHandle {
  getSnapshot: () => JournalEditorSnapshot | null;
}

export const JournalEditor = forwardRef<JournalEditorHandle, JournalEditorProps>(
function JournalEditor({
  initialContent,
  onChange,
  placeholder = "Start writing, or press '/' for commands...",
  autoFocus = false,
  className,
  compact = false,
  accountId,
  onApplyAICapture,
}: JournalEditorProps, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const aiCaptureInsertPosRef = useRef<number | null>(null);
  const [aiCaptureOpen, setAICaptureOpen] = useState(false);
  onChangeRef.current = onChange;

  const {
    slashMenuOpen,
    slashMenuPosition,
    slashQuery,
    setSlashMenuOpen,
    handleEditorUpdate,
    handleSlashSelect,
  } = useJournalSlashMenu({
    editorRef,
    onChangeRef,
  });

  const getInitialHtml = useCallback(() => {
    if (!initialContent?.length) return "";
    return blocksToHtml(initialContent);
  }, [initialContent]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: { class: "journal-heading" },
        },
        bulletList: {
          HTMLAttributes: { class: "journal-bullet-list" },
        },
        orderedList: {
          HTMLAttributes: { class: "journal-ordered-list" },
        },
        listItem: {
          HTMLAttributes: { class: "journal-list-item" },
        },
        blockquote: {
          HTMLAttributes: { class: "journal-blockquote" },
        },
        codeBlock: false,
        horizontalRule: {
          HTMLAttributes: { class: "journal-hr" },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty",
      }),
      TaskList.configure({
        HTMLAttributes: { class: "journal-task-list" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "journal-task-item" },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "journal-table" },
      }),
      TableRow.configure({
        HTMLAttributes: { class: "journal-table-row" },
      }),
      TableHeader.configure({
        HTMLAttributes: { class: "journal-table-header" },
      }),
      TableCell.configure({
        HTMLAttributes: { class: "journal-table-cell" },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: "journal-code-block" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "journal-link" },
      }),
      ChartNode.configure({}),
      TradeNode,
      InlineTradeNode,
      ImageNode,
      VideoNode,
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
    onUpdate: handleEditorUpdate,
  });

  const syncEditorContent = useCallback(() => {
    if (!editor) {
      return null;
    }

    const html = editor.getHTML();
    const content = htmlToBlocks(html);
    onChangeRef.current?.(content, html);

    return { content, html };
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot: () => syncEditorContent(),
    }),
    [syncEditorContent]
  );

  const {
    handleInsertBlock,
    handleInsertChart,
    handleInsertTrade,
    handleInsertTradeComparison,
    handleInsertImage,
    handleInsertVideo,
    handleInsertLink,
    handleInsertEmbed,
    handleInsertPsychology,
  } = useJournalEditorInsertActions({
    editor,
    accountId,
    afterInsert: syncEditorContent,
  });

  const handleOpenAICapture = useCallback(() => {
    if (!editor) {
      return;
    }

    aiCaptureInsertPosRef.current = editor.state.selection.from;
    setAICaptureOpen(true);
  }, [editor]);

  const handleAICaptureOpenChange = useCallback((open: boolean) => {
    if (!open) {
      aiCaptureInsertPosRef.current = null;
    }

    setAICaptureOpen(open);
  }, []);

  const handleApplyAICapture = useCallback(
    (capture: JournalAICaptureResult) => {
      let nextContent: JournalBlock[] | undefined;

      if (editor && capture.contentBlocks.length > 0) {
        const insertPosition =
          aiCaptureInsertPosRef.current ?? editor.state.selection.from;

        editor
          .chain()
          .focus()
          .insertContentAt(insertPosition, blocksToHtml(capture.contentBlocks))
          .run();

        nextContent = syncEditorContent()?.content;
      }

      onApplyAICapture?.(capture, nextContent);

      aiCaptureInsertPosRef.current = null;
      setAICaptureOpen(false);
    },
    [editor, onApplyAICapture, syncEditorContent]
  );

  if (!editor) {
    return (
      <div
        className={cn(
          compact ? "min-h-[28rem]" : "min-h-screen",
          "animate-pulse bg-sidebar-accent",
          className
        )}
      />
    );
  }

  return (
    <div
      ref={editorRef}
      data-compact={compact ? "true" : undefined}
      className={cn(
        "journal-editor relative",
        compact ? "min-h-[28rem]" : "min-h-screen",
        className
      )}
    >
      <JournalEditorStyles />
      <JournalEditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      <JournalAICaptureDialog
        open={aiCaptureOpen}
        onOpenChange={handleAICaptureOpenChange}
        onApply={handleApplyAICapture}
        accountId={accountId}
      />
      <SlashCommandsMenu
        isOpen={slashMenuOpen}
        position={slashMenuPosition}
        query={slashQuery}
        onSelect={(command) => handleSlashSelect(editor, command)}
        onClose={() => setSlashMenuOpen(false)}
        onInsertBlock={handleInsertBlock}
        onInsertChart={handleInsertChart}
        onInsertTrade={handleInsertTrade}
        onInsertTradeComparison={handleInsertTradeComparison}
        onInsertImage={handleInsertImage}
        onInsertVideo={handleInsertVideo}
        onInsertLink={handleInsertLink}
        onInsertEmbed={handleInsertEmbed}
        onInsertPsychology={handleInsertPsychology}
        onOpenAICapture={onApplyAICapture ? handleOpenAICapture : undefined}
      />
    </div>
  );
});

export type { Editor };
