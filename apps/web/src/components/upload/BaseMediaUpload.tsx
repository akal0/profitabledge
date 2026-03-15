import {
  AlertCircleIcon,
  PaperclipIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import React, { useEffect, useRef } from "react";
import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export type BaseMediaUploadProps = {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  title?: string;
  description?: string;
  onFilesChange?: (files: File[]) => void;
  className?: string;
};

const BaseMediaUpload: React.FC<BaseMediaUploadProps> = ({
  accept,
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  disabled,
  title = "Upload file",
  description,
  onFilesChange,
  className,
}) => {
  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    maxSize,
    accept: accept ?? "*",
    multiple: Boolean(multiple),
  });

  // Keep a stable ref to the callback to avoid retriggering effect on every render
  const onFilesChangeRef = useRef<typeof onFilesChange>(undefined);
  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    if (!onFilesChangeRef.current) return;
    const actualFiles: File[] = files
      .map((f) => f.file)
      .filter((f): f is File => f instanceof File);
    onFilesChangeRef.current(actualFiles);
  }, [files]);

  const file = files[0];
  const visibleFiles = files.slice(0, 3);
  const hiddenFiles = files.slice(3);
  const inputProps = getInputProps({ accept, multiple });

  return (
    <div className={className}>
      <div
        role="button"
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        className="border border-white/5 dark:bg-sidebar-accent hover:brightness-110 data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 flex min-h-40 flex-col items-center justify-center rounded-lg p-4 has-disabled:pointer-events-none has-disabled:opacity-50 has-[input:focus]:ring-[3px] group transition duration-250 cursor-pointer"
      >
        <input
          {...inputProps}
          className="sr-only"
          aria-label="Upload file"
          disabled={Boolean(file) || disabled}
        />

        <div className="flex flex-col items-center justify-center text-center gap-3 ">
          <div
            className="bg-sidebar-accent shadow-secondary-button flex size-12 shrink-0 items-center justify-center rounded-lg border border-white/5 group-hover:brightness-110 transition duration-150"
            aria-hidden="true"
          >
            <UploadIcon className="size-4 opacity-60" />
          </div>

          <div className="space-y-1">
            <p className=" text-sm font-semibold">{title}</p>

            <p className="text-secondary text-[11px]">
              {description ??
                `Drag & drop or click to browse (max. ${formatBytes(maxSize)})`}
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="text-destructive flex items-center gap-1 text-xs mt-2"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 mt-2">
          {visibleFiles.map((f) => (
            <div
              key={f.id}
              className="border border-white/5 flex items-center justify-between gap-2 px-4 py-1 bg-sidebar-accent rounded-lg"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <PaperclipIcon
                  className="size-3 shrink-0 opacity-60"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {f.file.name}
                  </p>
                </div>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground/80 hover:text-foreground -me-2 size-8 hover:bg-transparent"
                onClick={() => removeFile(f.id)}
                aria-label="Remove file"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}

          {hiddenFiles.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="border border-white/5 flex items-center gap-2 px-4 py-2 bg-sidebar-accent rounded-lg text-xs font-semibold text-white/75 transition duration-150 hover:brightness-110 cursor-pointer"
                >
                  <PaperclipIcon
                    className="size-3 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                  <span>+{hiddenFiles.length} more</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={8}
                className="max-w-xs p-3 overflow-hidden"
              >
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-white/45">
                    Uploaded files
                  </p>
                  <Separator className="-mx-6" />
                  <div className="space-y-2">
                    {hiddenFiles.map((fileItem) => (
                      <p
                        key={fileItem.id}
                        className="truncate text-xs font-medium text-white/80"
                      >
                        {fileItem.file.name}
                      </p>
                    ))}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
};

export default BaseMediaUpload;
