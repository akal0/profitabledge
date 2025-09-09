"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUploadThing } from "@/utils/uploadthing";
import { trpcClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";

export default function AvatarUploader({
  onUploaded,
  initialUrl,
  fallbackLabel,
  onReady,
  userId,
}: {
  onUploaded?: (url: string) => void;
  initialUrl?: string;
  fallbackLabel?: string;
  onReady?: (api: {
    pick: () => void;
    clear: () => void;
    getFile: () => File | null;
    upload: () => Promise<string | null>;
  }) => void;
  userId?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialUrl ?? null
  );
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPreviewUrl(initialUrl ?? null);
  }, [initialUrl]);

  const { startUpload, isUploading } = useUploadThing((r) => r.imageUploader, {
    headers: () => ({ "x-user-id": userId ?? "" }),
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url ?? null;
      if (url) onUploaded?.(url);
    },
  });

  const pick = useCallback(() => inputRef.current?.click(), []);
  const clear = useCallback(async () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    await trpcClient.users.clearImage.mutate();
    onUploaded?.("");
  }, [previewUrl, setPreviewUrl, setFile]);
  const getFile = useCallback(() => file, [file]);

  const upload = useCallback(async () => {
    if (!file || !userId) return null;
    const res = await startUpload([file]);
    const url = res?.[0]?.url ?? null;
    if (url) setPreviewUrl(url);
    return url;
  }, [file, userId, startUpload]);

  useEffect(() => {
    onReady?.({ pick, clear, getFile, upload });
  }, [onReady, pick, clear, getFile, upload]);

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : initialUrl ?? null);
  };

  return (
    <div className="inline-flex items-center gap-3">
      <div className="shadow-sidebar-button relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <Avatar className="rounded-full size-9">
          <AvatarImage
            src={previewUrl ?? undefined}
            alt="profile picture"
            className="object-cover"
          />
          <AvatarFallback className="flex items-center justify-center text-xs">
            {fallbackLabel?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="sr-only"
        aria-label="Select avatar image"
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={pick}
          className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 px-3 items-center justify-center w-max"
          disabled={isUploading}
        >
          {file ? "Change profile picture" : "Choose profile picture"}
        </Button>

        <Button
          type="button"
          onClick={clear}
          className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-red-700 hover:bg-red-700 cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 px-3 items-center justify-center w-max"
          disabled={isUploading}
        >
          Remove profile picture
        </Button>
      </div>
    </div>
  );
}
