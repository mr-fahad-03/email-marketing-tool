import { Edit3, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import type { MarketingTemplate } from '@/lib/types/template';

interface TemplateDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MarketingTemplate | null;
  onEdit: (template: MarketingTemplate) => void;
  onPreview: (template: MarketingTemplate) => void;
}

function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function TemplateDetailsDialog({
  open,
  onOpenChange,
  template,
  onEdit,
  onPreview,
}: TemplateDetailsDialogProps) {
  if (!template) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-3xl overflow-auto border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            {template.name}
            <Badge variant={template.type === 'email' ? 'neutral' : 'warning'}>{template.type}</Badge>
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            View template details and open editor when needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Subject</p>
              <p className="mt-1 text-sm text-zinc-200">{template.subject || '-'}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Category</p>
              <p className="mt-1 text-sm text-zinc-200">{getTemplateCategoryLabel(template.category)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Editor</p>
              <p className="mt-1 text-sm text-zinc-200">
                {template.editorType === 'layout' ? 'Layout editor' : 'HTML editor'}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Visibility</p>
              <p className="mt-1 text-sm text-zinc-200">{template.visibility ?? 'personal'}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Created</p>
              <p className="mt-1 text-sm text-zinc-200">{formatDate(template.createdAt)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500">Updated</p>
              <p className="mt-1 text-sm text-zinc-200">{formatDate(template.updatedAt)}</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs text-zinc-500">Variables</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {template.variables.length === 0 ? (
                <span className="text-xs text-zinc-500">No variables</span>
              ) : (
                template.variables.map((variable) => (
                  <span
                    key={variable}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => onPreview(template)}
          >
            <Eye className="mr-1 h-4 w-4" />
            Preview
          </Button>
          <Button type="button" onClick={() => onEdit(template)}>
            <Edit3 className="mr-1 h-4 w-4" />
            Edit Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
