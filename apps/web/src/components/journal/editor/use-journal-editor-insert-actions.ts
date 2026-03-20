"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

import type { ChartEmbedType } from "@/components/journal/types";
import { useUploadThing } from "@/utils/uploadthing";

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
  const { startUpload: startVideoUpload } = useUploadThing(
    (router) => router.videoUploader
  );

  const generateVideoPreview = useCallback((file: File) => {
    return new Promise<{
      thumbnail: string | null;
      duration: number | null;
    }>((resolve) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);

      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
        URL.revokeObjectURL(objectUrl);
      };

      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : null;
        const seekTime = duration && duration > 0.2 ? Math.min(1, duration / 3) : null;

        if (!seekTime) {
          cleanup();
          resolve({ thumbnail: null, duration });
          return;
        }

        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const duration = Number.isFinite(video.duration) ? video.duration : null;
        cleanup();
        resolve({
          thumbnail: canvas.toDataURL("image/jpeg", 0.78),
          duration,
        });
      };

      video.onerror = () => {
        cleanup();
        resolve({ thumbnail: null, duration: null });
      };

      video.src = objectUrl;
    });
  }, []);

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

  const handleInsertVideo = useCallback(() => {
    if (!editor) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        toast.error("Please choose a video file");
        return;
      }

      if (file.size > 64 * 1024 * 1024) {
        toast.error("Video must be under 64MB");
        return;
      }

      try {
        const [preview, uploadResult] = await Promise.all([
          generateVideoPreview(file),
          startVideoUpload([file]),
        ]);
        const videoUrl = uploadResult?.[0]?.ufsUrl ?? uploadResult?.[0]?.url;
        if (!videoUrl) {
          throw new Error("Failed to upload video");
        }

        editor
          .chain()
          .focus()
          .insertContent([
            {
              type: "journalVideo",
              attrs: {
                src: videoUrl,
                thumbnail: preview.thumbnail,
                duration: preview.duration,
                caption: file.name,
                autoplay: false,
                muted: true,
              },
            },
            { type: "paragraph" },
          ])
          .run();

        afterInsert?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload video"
        );
      }
    };
    input.click();
  }, [afterInsert, editor, generateVideoPreview, startVideoUpload]);

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
    handleInsertVideo,
    handleInsertLink,
    handleInsertEmbed,
    handleInsertPsychology,
  };
}
