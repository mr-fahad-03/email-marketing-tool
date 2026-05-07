import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTemplateCategoryLabel } from '@/lib/constants/template-categories';
import type { TemplateLibraryItem } from '@/lib/constants/email-template-library';

interface TemplateLibraryPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TemplateLibraryItem | null;
  onUseTemplate: (item: TemplateLibraryItem) => void;
}

function toPreviewDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${html}</body></html>`;
}

export function TemplateLibraryPreviewDialog({
  open,
  onOpenChange,
  item,
  onUseTemplate,
}: TemplateLibraryPreviewDialogProps) {
  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-[1100px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {getTemplateCategoryLabel(item.category)} template
          </DialogDescription>
        </DialogHeader>

        {item.body ? (
          <iframe
            title={`${item.name} full preview`}
            className="h-[560px] w-full rounded-md border border-zinc-800 bg-white"
            sandbox=""
            srcDoc={toPreviewDocument(item.body)}
          />
        ) : null}

        {item.previewImageUrl && !item.body ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              This template preview is provided by the external template API. Click
              {' '}
              &quot;Use Template&quot; to import full HTML into your editor.
            </p>
            <img
              src={item.previewImageUrl}
              alt={`${item.name} preview`}
              className="max-h-[420px] w-full rounded-md border border-zinc-800 object-cover object-top"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              onUseTemplate(item);
              onOpenChange(false);
            }}
          >
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
