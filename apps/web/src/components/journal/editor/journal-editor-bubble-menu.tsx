"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";

import { FormatButton } from "@/components/journal/editor/format-button";

interface JournalEditorBubbleMenuProps {
  editor: Editor;
}

export function JournalEditorBubbleMenu({
  editor,
}: JournalEditorBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-sidebar p-1 shadow-xl"
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
      <div className="mx-1 h-4 w-px bg-white/10" />
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
      <div className="mx-1 h-4 w-px bg-white/10" />
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
      <div className="mx-1 h-4 w-px bg-white/10" />
      <FormatButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .setLink({ href: window.prompt("Enter URL:") || "" })
            .run()
        }
        isActive={editor.isActive("link")}
        title="Link"
      >
        <LinkIcon className="h-4 w-4" />
      </FormatButton>
      <div className="mx-1 h-4 w-px bg-white/10" />
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
  );
}
