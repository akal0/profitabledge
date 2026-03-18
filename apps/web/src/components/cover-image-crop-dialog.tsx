"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";

interface CoverImageCropDialogProps {
  open: boolean;
  imageSrc: string;
  aspectRatio: number;
  onApply: (objectPosition: string) => void;
  onCancel: () => void;
}

export function CoverImageCropDialog({
  open,
  imageSrc,
  aspectRatio,
  onApply,
  onCancel,
}: CoverImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area>({ x: 0, y: 0, width: 100, height: 100 });

  const onCropComplete = useCallback((areaPercent: Area, _pixels: Area) => {
    if (areaPercent.width > 0 && areaPercent.height > 0) {
      setCroppedArea(areaPercent);
    }
  }, []);

  const handleApply = () => {
    const cx = (croppedArea.x + croppedArea.width / 2).toFixed(2);
    const cy = (croppedArea.y + croppedArea.height / 2).toFixed(2);
    onApply(`${cx}% ${cy}%`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="max-w-2xl w-full bg-sidebar border border-white/10 p-0 overflow-hidden gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-semibold text-white">
            Adjust cover image
          </DialogTitle>
          <p className="text-xs text-white/40 mt-0.5">
            Drag to reposition · Scroll or use the slider to zoom
          </p>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full bg-black" style={{ height: 280 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: {
                border: "2px solid rgba(255,255,255,0.6)",
                borderRadius: 4,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-5 py-4">
          <ZoomOut className="size-4 text-white/40 shrink-0" />
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <ZoomIn className="size-4 text-white/40 shrink-0" />
        </div>

        <DialogFooter className="px-5 pb-5 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="ring ring-teal-500/25 bg-teal-600/25 hover:bg-teal-600/35 text-teal-300 cursor-pointer"
            onClick={handleApply}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
