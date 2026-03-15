"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";

import type { ChartEmbedType } from "@/components/journal/types";

interface UseJournalEditorInsertActionsOptions {
  editor: Editor | null;
  accountId?: string;
  afterInsert?: () => void;
}

export function useJournalEditorInsertActions({
  editor,
  accountId,
  afterInsert,
}: UseJournalEditorInsertActionsOptions) {
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
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
          break;
        default:
          editor.chain().focus().setParagraph().run();
      }

      afterInsert?.();
    },
    [afterInsert, editor]
  );

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
              height: 400,
            },
          },
          { type: "paragraph" },
        ])
        .run();

      afterInsert?.();
    },
    [accountId, afterInsert, editor]
  );

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
    afterInsert?.();
  }, [afterInsert, editor]);

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
    afterInsert?.();
  }, [afterInsert, editor]);

  const handleInsertImage = useCallback(() => {
    if (!editor) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const dataUrl = readerEvent.target?.result as string;
        if (!dataUrl) return;

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

        afterInsert?.();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [afterInsert, editor]);

  const handleInsertLink = useCallback(() => {
    if (!editor) return;

    const url = window.prompt("Enter URL:");
    if (!url) return;

    if (!editor.state.selection.empty) {
      editor.chain().focus().setLink({ href: url }).run();
      afterInsert?.();
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent(`<a href="${url}">${url}</a>`)
      .run();
    afterInsert?.();
  }, [afterInsert, editor]);

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
    afterInsert?.();
  }, [afterInsert, editor]);

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
    afterInsert?.();
  }, [afterInsert, editor]);

  return {
    handleInsertBlock,
    handleInsertChart,
    handleInsertTrade,
    handleInsertTradeComparison,
    handleInsertImage,
    handleInsertLink,
    handleInsertEmbed,
    handleInsertPsychology,
  };
}
