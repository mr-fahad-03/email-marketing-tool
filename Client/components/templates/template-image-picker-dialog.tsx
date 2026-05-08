"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateImageFile } from "@/lib/types/template-image";
import { TemplateImageManagerPanel } from "./template-image-manager-panel";

interface TemplateImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (imageUrl: string, file: TemplateImageFile) => void;
}

export function TemplateImagePickerDialog({
  open,
  onOpenChange,
  onSelectImage,
}: TemplateImagePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto border-zinc-200 bg-zinc-50 p-5 text-zinc-900">
        <DialogHeader>
          <DialogTitle>Image Manager</DialogTitle>
        </DialogHeader>

        <TemplateImageManagerPanel
          showSelectAction
          onSelectImage={(imageUrl, file) => {
            onSelectImage(imageUrl, file);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
