"use client";

import {
  type ChangeEvent,
  type ChangeEventHandler,
  type ClipboardEventHandler,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";
import {
  InputGroup,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  type AttachmentsContext,
  LocalAttachmentsContext,
  useOptionalPromptInputController,
  usePromptInputAttachments,
} from "@/features/ai/prompt-input/lib/prompt-input-context";

export type PromptInputMessage = {
  text: string;
  files: FileUIPart[];
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> & {
  accept?: string;
  multiple?: boolean;
  globalDrop?: boolean;
  syncHiddenInput?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const files = usingProvider ? controller.attachments.files : items;

  const filesRef = useRef(files);
  filesRef.current = files;

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (file: File) => {
      if (!accept || accept.trim() === "") return true;

      const patterns = accept
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return patterns.some((pattern) => {
        if (pattern.endsWith("/*")) {
          const prefix = pattern.slice(0, -1);
          return file.type.startsWith(prefix);
        }
        return file.type === pattern;
      });
    },
    [accept]
  );

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = Array.from(fileList);
      const accepted = incoming.filter((file) => matchesAccept(file));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }

      const sized = accepted.filter((file) =>
        maxFileSize ? file.size <= maxFileSize : true
      );
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }

      setItems((previous) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - previous.length)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;

        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }

        return previous.concat(
          capped.map((file) => ({
            id: nanoid(),
            type: "file" as const,
            url: URL.createObjectURL(file),
            mediaType: file.type,
            filename: file.name,
          }))
        );
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError]
  );

  const removeLocal = useCallback((id: string) => {
    setItems((previous) => {
      const found = previous.find((file) => file.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return previous.filter((file) => file.id !== id);
    });
  }, []);

  const clearLocal = useCallback(() => {
    setItems((previous) => {
      for (const file of previous) {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      }
      return [];
    });
  }, []);

  const add = usingProvider ? controller.attachments.add : addLocal;
  const remove = usingProvider ? controller.attachments.remove : removeLocal;
  const clear = usingProvider ? controller.attachments.clear : clearLocal;
  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  useEffect(() => {
    if (!usingProvider) return;
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || globalDrop) return;

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
      if (event.dataTransfer?.files?.length) {
        add(event.dataTransfer.files);
      }
    };

    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(() => {
    if (!globalDrop) return;

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
      if (event.dataTransfer?.files?.length) {
        add(event.dataTransfer.files);
      }
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(
    () => () => {
      if (!usingProvider) {
        for (const file of filesRef.current) {
          if (file.url) URL.revokeObjectURL(file.url);
        }
      }
    },
    [usingProvider]
  );

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
    }
    event.currentTarget.value = "";
  };

  const convertBlobUrlToDataUrl = async (
    url: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: files.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [files, add, remove, clear, openFileDialog]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const text = usingProvider
      ? controller.textInput.value
      : ((new FormData(form).get("message") as string) || "");

    if (!usingProvider) {
      form.reset();
    }

    Promise.all(
      files.map(async ({ id, ...item }) => {
        if (item.url && item.url.startsWith("blob:")) {
          const dataUrl = await convertBlobUrlToDataUrl(item.url);
          return { ...item, url: dataUrl ?? item.url };
        }
        return item;
      })
    )
      .then((convertedFiles: FileUIPart[]) => {
        try {
          const result = onSubmit({ text, files: convertedFiles }, event);
          if (result instanceof Promise) {
            result
              .then(() => {
                clear();
                if (usingProvider) {
                  controller.textInput.clear();
                }
              })
              .catch(() => {});
          } else {
            clear();
            if (usingProvider) {
              controller.textInput.clear();
            }
          }
        } catch {}
      })
      .catch(() => {});
  };

  const inner = (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}
      >
        <InputGroup className="overflow-hidden">{children}</InputGroup>
      </form>
    </>
  );

  return usingProvider ? (
    inner
  ) : (
    <LocalAttachmentsContext.Provider value={ctx}>
      {inner}
    </LocalAttachmentsContext.Provider>
  );
};

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;
export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter") {
      if (isComposing || event.nativeEvent.isComposing) return;
      if (event.shiftKey) return;
      event.preventDefault();

      const form = event.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) return;
      form?.requestSubmit();
    }

    if (
      event.key === "Backspace" &&
      event.currentTarget.value === "" &&
      attachments.files.length > 0
    ) {
      event.preventDefault();
      const lastAttachment = attachments.files.at(-1);
      if (lastAttachment) {
        attachments.remove(lastAttachment.id);
      }
    }
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      event.preventDefault();
      attachments.add(pastedFiles);
    }
  };

  const controlledProps = controller
    ? {
        value: controller.textInput.value,
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(event.currentTarget.value);
          onChange?.(event);
        },
      }
    : { onChange };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      {...controlledProps}
    />
  );
};
