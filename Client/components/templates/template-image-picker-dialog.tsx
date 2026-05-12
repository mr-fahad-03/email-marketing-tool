"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      <DialogContent className="z-[10000] max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto border-zinc-200 bg-zinc-50 p-5 text-zinc-900">
        <DialogHeader>
          <DialogTitle>Image Manager</DialogTitle>
          <DialogDescription className="sr-only">
            Select an image from your library to insert into the email template.
          </DialogDescription>
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
