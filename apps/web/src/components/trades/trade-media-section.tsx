"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaDropzone, type MediaFile } from "@/components/media/media-dropzone";
import {
  Image as ImageIcon,
  Video,
  MoreVertical,
  Trash2,
  Edit2,
  Download,
  Flag,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TRADE_ACTION_BUTTON_CLASS,
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_ACTION_ICON_BUTTON_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";

interface TradeMediaSectionProps {
  tradeId: string;
  className?: string;
}

type TradeMediaItem = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  altText?: string | null;
  caption?: string | null;
  description?: string | null;
  isEntryScreenshot?: boolean | null;
  isExitScreenshot?: boolean | null;
  isAnalysis?: boolean | null;
};

export function TradeMediaSection({ tradeId, className }: TradeMediaSectionProps) {
  const journalApi = (trpc as any).journal;
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<TradeMediaItem | null>(null);

  // Fetch existing media
  const { data: existingMediaRaw, isLoading, refetch } = journalApi.listTradeMedia.useQuery(
    { tradeId },
    { enabled: !!tradeId }
  );
  const existingMedia = (existingMediaRaw as TradeMediaItem[] | undefined) ?? [];

  // Create media mutation
  const createMedia = journalApi.createTradeMedia.useMutation({
    onSuccess: () => {
      toast.success("Media uploaded successfully");
      refetch();
    },
    onError: (err: { message?: string }) => {
      toast.error(`Failed to upload: ${err.message || "Unknown error"}`);
    },
  });

  // Update media mutation
  const updateMedia = journalApi.updateTradeMedia.useMutation({
    onSuccess: () => {
      toast.success("Updated successfully");
      refetch();
    },
    onError: (err: { message?: string }) => {
      toast.error(`Failed to update: ${err.message || "Unknown error"}`);
    },
  });

  // Delete media mutation
  const deleteMedia = journalApi.deleteTradeMedia.useMutation({
    onSuccess: () => {
      toast.success("Media deleted");
      refetch();
    },
    onError: (err: { message?: string }) => {
      toast.error(`Failed to delete: ${err.message || "Unknown error"}`);
    },
  });

  // Convert MediaFile to backend format and upload
  const uploadMedia = useCallback(async (file: MediaFile) => {
    try {
      // Convert file to base64 or upload to storage
      // For now, we'll use the preview URL as the URL
      // In production, this should upload to S3/R2
      
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        
        await createMedia.mutateAsync({
          tradeId,
          mediaType: file.type,
          url: dataUrl,
          thumbnailUrl: file.preview,
          fileName: file.file.name,
          fileSize: file.file.size,
          mimeType: file.file.type,
          width: 0,
          height: 0,
        });
      };
      reader.readAsDataURL(file.file);
    } catch (err) {
      console.error("Upload error:", err);
    }
  }, [tradeId, createMedia]);

  const handleFilesSelected = useCallback((files: MediaFile[]) => {
    setMediaFiles((prev) => [...prev, ...files]);
    // Upload each file
    files.forEach(uploadMedia);
  }, [uploadMedia]);

  const handleRemoveFile = useCallback((id: string) => {
    setMediaFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDeleteExisting = useCallback((mediaId: string) => {
    deleteMedia.mutate({ id: mediaId });
  }, [deleteMedia]);

  const handleUpdateCaption = useCallback((mediaId: string, caption: string) => {
    updateMedia.mutate({ id: mediaId, caption });
    setEditingCaption(null);
  }, [updateMedia]);

  const handleUpdateDescription = useCallback((mediaId: string, description: string) => {
    updateMedia.mutate({ id: mediaId, description });
    setEditingDescription(null);
  }, [updateMedia]);

  const handleSetFlags = useCallback((mediaId: string, flags: { isEntryScreenshot?: boolean; isExitScreenshot?: boolean; isAnalysis?: boolean }) => {
    updateMedia.mutate({ id: mediaId, ...flags });
  }, [updateMedia]);

  const openLightbox = useCallback((media: TradeMediaItem) => {
    setLightboxMedia(media);
    setLightboxOpen(true);
  }, []);

  const isImage = (mimeType?: string | null) => mimeType?.startsWith("image/");
  const isVideo = (mimeType?: string | null) => mimeType?.startsWith("video/");

  return (
    <div className={cn("space-y-4", className)}>

      {/* Existing Media */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        existingMedia.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {existingMedia.map((media: TradeMediaItem) => (
              <div
                key={media.id}
                className={cn(
                  TRADE_SURFACE_CARD_CLASS,
                  "group relative aspect-video overflow-hidden"
                )}
              >
                {isImage(media.mimeType) ? (
                  <img
                    src={media.url}
                    alt={media.altText || media.fileName || "Trade media"}
                    className="h-full w-full object-cover cursor-pointer"
                    onClick={() => openLightbox(media)}
                  />
                ) : isVideo(media.mimeType) ? (
                  <div className="relative h-full w-full">
                    {media.thumbnailUrl ? (
                      <img
                        src={media.thumbnailUrl}
                        alt={media.fileName || "Video thumbnail"}
                        className="h-full w-full object-cover cursor-pointer"
                        onClick={() => openLightbox(media)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-sidebar-accent">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="h-8 w-8 text-white" />
                    </div>
                  </div>
                ) : null}

                {/* Flags */}
                <div className="absolute left-1 top-1 flex gap-1">
                  {media.isEntryScreenshot && (
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.positive,
                        "min-h-5 px-1.5 py-0.5 text-[10px]"
                      )}
                    >
                      Entry
                    </span>
                  )}
                  {media.isExitScreenshot && (
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.info,
                        "min-h-5 px-1.5 py-0.5 text-[10px]"
                      )}
                    >
                      Exit
                    </span>
                  )}
                  {media.isAnalysis && (
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.violet,
                        "min-h-5 px-1.5 py-0.5 text-[10px]"
                      )}
                    >
                      Analysis
                    </span>
                  )}
                </div>

                {/* Dropdown Menu */}
                <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className={cn(TRADE_ACTION_ICON_BUTTON_CLASS, "h-6 w-6")}
                      >
                        <MoreVertical className="h-3 w-3 text-white" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleSetFlags(media.id, { isEntryScreenshot: !media.isEntryScreenshot })}
                      >
                        <Flag className="mr-2 h-3 w-3" />
                        {media.isEntryScreenshot ? "Remove Entry Flag" : "Mark as Entry"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSetFlags(media.id, { isExitScreenshot: !media.isExitScreenshot })}
                      >
                        <Flag className="mr-2 h-3 w-3" />
                        {media.isExitScreenshot ? "Remove Exit Flag" : "Mark as Exit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSetFlags(media.id, { isAnalysis: !media.isAnalysis })}
                      >
                        <Flag className="mr-2 h-3 w-3" />
                        {media.isAnalysis ? "Remove Analysis Flag" : "Mark as Analysis"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingCaption(media.id);
                        setCaptionValue(media.caption || "");
                      }}>
                        <Edit2 className="mr-2 h-3 w-3" />
                        Edit Caption
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingDescription(media.id);
                        setDescriptionValue(media.description || "");
                      }}>
                        <Edit2 className="mr-2 h-3 w-3" />
                        Edit Description
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.open(media.url, "_blank")}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Download Original
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteExisting(media.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Caption overlay */}
                {media.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white truncate">{media.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Caption Edit Dialog */}
      <Dialog open={!!editingCaption} onOpenChange={() => setEditingCaption(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-md"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 shrink-0">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Edit2 className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Edit Caption</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Add a short caption for this media.
                </p>
              </div>
              <DialogClose asChild>
                <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />
            {/* Body */}
            <div className="px-5 py-4">
              <Textarea
                value={captionValue}
                onChange={(e) => setCaptionValue(e.target.value)}
                placeholder="Enter caption..."
                className="min-h-[80px] bg-sidebar-accent border-white/10"
              />
            </div>
            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setEditingCaption(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editingCaption &&
                  handleUpdateCaption(editingCaption, captionValue)
                }
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Description Edit Dialog */}
      <Dialog open={!!editingDescription} onOpenChange={() => setEditingDescription(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-lg"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 shrink-0">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Edit2 className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Edit Description</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Add a detailed description or analysis notes.
                </p>
              </div>
              <DialogClose asChild>
                <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />
            {/* Body */}
            <div className="px-5 py-4">
              <Textarea
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                placeholder="Enter description..."
                className="min-h-[150px] bg-sidebar-accent border-white/10"
              />
            </div>
            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setEditingDescription(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editingDescription &&
                  handleUpdateDescription(editingDescription, descriptionValue)
                }
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
          {lightboxMedia && (
            <>
              {isImage(lightboxMedia.mimeType) ? (
                <img
                  src={lightboxMedia.url}
                  alt={lightboxMedia.altText || lightboxMedia.fileName || "Media"}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              ) : isVideo(lightboxMedia.mimeType) ? (
                <video
                  src={lightboxMedia.url}
                  controls
                  autoPlay
                  className="w-full h-auto max-h-[80vh]"
                />
              ) : null}
              {lightboxMedia.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
                  <p className="text-white">{lightboxMedia.caption}</p>
                  {lightboxMedia.description && (
                    <p className="text-white/70 text-sm mt-1">{lightboxMedia.description}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dropzone for new uploads */}
      <MediaDropzone
        files={mediaFiles}
        onFilesSelected={handleFilesSelected}
        onFileRemove={handleRemoveFile}
        accept="all"
        maxFiles={20}
      />
    </div>
  );
}
