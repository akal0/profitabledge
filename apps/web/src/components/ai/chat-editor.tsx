"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createChatSuggestion } from "./chat-suggestion";
import type { SuggestionItem } from "./types";
import { cn } from "@/lib/utils";

interface ChatEditorProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSubmit?: (content: string) => void;
  onChange?: (content: string) => void;
  onHtmlChange?: (html: string) => void;
  fetchSuggestions: (
    query: string,
    type: "mention" | "command"
  ) => Promise<SuggestionItem[]>;
}

export interface ChatEditorHandle {
  clear: () => void;
  focus: () => void;
  insertText: (text: string) => void;
  setText: (text: string) => void;
}

const mentionColors: Record<string, string> = {
  session: "bg-emerald-500/20 text-emerald-200",
  model: "bg-sky-500/20 text-sky-200",
  symbol: "bg-purple-500/20 text-purple-200",
  field: "bg-amber-500/20 text-amber-200",
};

export const ChatEditor = forwardRef<ChatEditorHandle, ChatEditorProps>(
  (
    {
      placeholder = "Ask about your trades, performance, or trading edge...",
      onSubmit,
      onChange,
      onHtmlChange,
      disabled,
      className,
      fetchSuggestions,
    },
    ref
  ) => {
    const suggestionActiveRef = useRef(false);
    const fetchSuggestionsRef = useRef(fetchSuggestions);

    useEffect(() => {
      fetchSuggestionsRef.current = fetchSuggestions;
    }, [fetchSuggestions]);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder,
        }),
        Mention.configure({
          HTMLAttributes: {
            class: "mention",
          },
          suggestion: {
            char: "@",
            ...createChatSuggestion(
              (query) => fetchSuggestionsRef.current(query, "mention"),
              suggestionActiveRef
            ),
          },
          renderText: ({ node }) => `@${node.attrs.label}`,
          renderHTML: ({ node }) => {
            const entityType = node.attrs.type || "session";
            const colorClass =
              mentionColors[entityType] || mentionColors.session;
            return [
              "span",
              {
                class: `mention px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`,
                "data-type": entityType,
              },
              `@${node.attrs.label}`,
            ];
          },
        }),
        Mention.extend({ name: "slashCommand" }).configure({
          HTMLAttributes: {
            class: "slash-command",
          },
          suggestion: {
            char: "/",
            ...createChatSuggestion(
              (query) => fetchSuggestionsRef.current(query, "command"),
              suggestionActiveRef
            ),
          },
          renderText: ({ node }) => `/${node.attrs.label}`,
          renderHTML: ({ node }) => {
            const commandType = node.attrs.type || "field";
            const colorClass =
              mentionColors[commandType] || mentionColors.field;
            return [
              "span",
              {
                class: `slash-command px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`,
                "data-type": commandType,
              },
              `/${node.attrs.label}`,
            ];
          },
        }),
      ],
      editorProps: {
        attributes: {
          "data-placeholder": placeholder,
          class:
            "outline-none min-h-[96px] max-h-[220px] overflow-y-auto text-white placeholder:text-white/50",
        },
        handleKeyDown: (_view, event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !suggestionActiveRef.current
          ) {
            event.preventDefault();
            handleSubmit();
            return true;
          }
          return false;
        },
      },
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getText());
        onHtmlChange?.(editor.getHTML());
      },
    });

    const handleSubmit = useCallback(() => {
      if (!editor || disabled) return;
      const content = editor.getText().trim();
      if (!content) return;
      onSubmit?.(content);
    }, [disabled, editor, onSubmit]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        editor?.commands.clearContent();
      },
      focus: () => {
        editor?.commands.focus();
      },
      insertText: (text: string) => {
        if (!editor) return;
        editor.commands.focus();
        editor.commands.insertContent(text);
      },
      setText: (text: string) => {
        if (!editor) return;
        editor.commands.setContent(text);
        editor.commands.focus("end");
      },
    }));

    if (!editor) {
      return null;
    }

    return (
      <div
        className={cn("w-full hover:bg-sidebar-accent p-2 pb-3 text-sm", className)}
      >
        <EditorContent editor={editor} className="px-4 pt-3 pb-5" />
      </div>
    );
  }
);

ChatEditor.displayName = "ChatEditor";
