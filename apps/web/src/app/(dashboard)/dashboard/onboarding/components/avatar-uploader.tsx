"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUploadThing } from "@/utils/uploadthing";
import { trpcClient } from "@/utils/trpc";

type Me = Awaited<ReturnType<typeof trpcClient.users.me.query>>;

export default function AvatarUploader({
  onUploaded,
  initialUrl,
  fallbackLabel,
}: {
  onUploaded?: (url: string) => void;
  initialUrl?: string;
  fallbackLabel?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialUrl ?? null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:"))
        URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const { startUpload } = useUploadThing((r) => r.imageUploader, {
    onUploadBegin: () => setIsUploading(true),
    onUploadError: () => setIsUploading(false),
    onClientUploadComplete: (res) => {
      setIsUploading(false);
      const url = res?.[0]?.url;
      if (url) {
        setPreviewUrl(url);
        onUploaded?.(url);
      }
    },
  });

  const handlePick = () => inputRef.current?.click();

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    await startUpload([file]);
  };

  const handleRemove = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(initialUrl ?? null);
    setFileName(null);
  };

  const getInfo = async () => {
    const me = await trpcClient.users.me.query();

    return me;
  };

  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getInfo();
      setMe(data);
    })();
  }, []);

  return (
    <div className="inline-flex items-center gap-3">
      <div className="shadow-sidebar-button relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <Avatar className="rounded-full size-9">
          <AvatarImage
            src={(previewUrl || me?.image) ?? ""}
            alt="profile picture"
            className="object-cover"
          />
          <AvatarFallback className="flex items-center justify-center text-xs">
            {me?.email?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex gap-2">
        <Button
          className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center w-full"
          onClick={handlePick}
          aria-haspopup="dialog"
          type="button"
          disabled={isUploading}
        >
          {fileName ? "Change image" : "Upload image"}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="sr-only"
          aria-label="Upload image file"
          tabIndex={-1}
        />

        {fileName && (
          <div className="inline-flex gap-2 text-xs">
            <Button
              type="button"
              onClick={handleRemove}
              className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-red-800 hover:bg-red-800 cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center w-full"
              aria-label={`Remove ${fileName}`}
              disabled={isUploading}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
