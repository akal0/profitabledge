"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Editor } from "@tiptap/react";

import { htmlToBlocks } from "@/components/journal/editor/serialization";
import type { SlashCommandItem } from "@/components/journal/slash-commands";
import type { JournalBlock } from "@/components/journal/types";

interface UseJournalSlashMenuOptions {
  editorRef: MutableRefObject<HTMLDivElement | null>;
  onChangeRef: MutableRefObject<
    ((content: JournalBlock[], html: string) => void) | undefined
  >;
}

export function useJournalSlashMenu({
  editorRef,
  onChangeRef,
}: UseJournalSlashMenuOptions) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const slashStartPos = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        slashMenuOpen &&
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setSlashMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [editorRef, slashMenuOpen]);

  const handleEditorUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      const isInCodeBlock = $from.parent.type.name === "codeBlock";

      if (isInCodeBlock) {
        if (slashMenuOpen) {
          setSlashMenuOpen(false);
          slashStartPos.current = null;
        }

        const html = editor.getHTML();
        onChangeRef.current?.(htmlToBlocks(html), html);
        return;
      }

      const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        "\ufffc"
      );
      const lastSlashIndex = textBefore.lastIndexOf("/");

      if (lastSlashIndex !== -1) {
        const textAfterSlash = textBefore.slice(lastSlashIndex + 1);
        if (!textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")) {
          if (!slashMenuOpen) {
            const nodeStart = from - $from.parentOffset;
            slashStartPos.current = nodeStart + lastSlashIndex;
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

      const html = editor.getHTML();
      onChangeRef.current?.(htmlToBlocks(html), html);
    },
    [onChangeRef, slashMenuOpen]
  );

  const handleSlashSelect = useCallback(
    (editor: Editor | null, command: SlashCommandItem) => {
      if (!editor || slashStartPos.current === null) return;

      const slashPos = slashStartPos.current;
      const cursorPos = editor.state.selection.from;
      setSlashMenuOpen(false);
      slashStartPos.current = null;
      setSlashQuery("");

      editor
        .chain()
        .focus()
        .deleteRange({
          from: slashPos,
          to: cursorPos,
        })
        .run();

      command.action();
    },
    []
  );

  return {
    slashMenuOpen,
    slashMenuPosition,
    slashQuery,
    setSlashMenuOpen,
    handleEditorUpdate,
    handleSlashSelect,
  };
}
