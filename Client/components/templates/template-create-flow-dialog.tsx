'use client';

import { Code2, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { LAYOUT_PRESET_DEFINITIONS } from '@/lib/constants/template-layouts';
import { env } from '@/lib/config/env';
import type { TemplateLayoutPreset } from '@/lib/types/template';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CreationStep = 'method' | 'layout';

interface TemplateCreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectHtmlEditor: () => void;
  onSelectLayoutEditor: (preset: TemplateLayoutPreset) => void;
}

export function TemplateCreateFlowDialog({
  open,
  onOpenChange,
  onSelectHtmlEditor,
  onSelectLayoutEditor,
}: TemplateCreateFlowDialogProps) {
  const [step, setStep] = useState<CreationStep>('method');
  const visualEditorLabel =
    env.templateVisualEditor === 'unlayer'
      ? 'Professional Visual Editor'
      : 'Layout Template Editor';

  const visualEditorDescription =
    env.templateVisualEditor === 'unlayer'
      ? 'Use a professional drag-and-drop builder with reusable design JSON and production-ready HTML export.'
      : 'Start from a pre-built layout and customize the content with a visual editor.';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('method');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-[1000px] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
        {step === 'method' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-3xl">New template</DialogTitle>
              <DialogDescription className="text-zinc-400">
                How would you like to create your template?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-left transition hover:border-emerald-500 hover:bg-zinc-900"
                onClick={() => setStep('layout')}
              >
                <LayoutTemplate className="mb-4 h-8 w-8 text-emerald-400" />
                <p className="text-lg font-semibold">{visualEditorLabel}</p>
                <p className="mt-2 text-sm text-zinc-400">{visualEditorDescription}</p>
              </button>
              <button
                type="button"
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-left transition hover:border-sky-500 hover:bg-zinc-900"
                onClick={onSelectHtmlEditor}
              >
                <Code2 className="mb-4 h-8 w-8 text-sky-400" />
                <p className="text-lg font-semibold">HTML Editor</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Build your template directly with HTML source code and full markup control.
                </p>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Choose a layout</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Pick a starting structure, then customize text, media, and styles.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LAYOUT_PRESET_DEFINITIONS.filter((item) => item.id !== 'empty').map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-emerald-500 hover:bg-zinc-900"
                  onClick={() => onSelectLayoutEditor(preset.id)}
                >
                  <p className="font-semibold text-zinc-100">{preset.label}</p>
                  <p className="mt-2 text-sm text-zinc-400">{preset.description}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={() => setStep('method')}
              >
                Back
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
