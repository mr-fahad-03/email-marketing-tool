import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseLayoutEditorFlowOptions {
  initialTemplateName?: string;
}

export function useLayoutEditorFlow({ initialTemplateName = '' }: UseLayoutEditorFlowOptions) {
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isNameStepOpen, setIsNameStepOpen] = useState(false);
  const [templateName, setTemplateName] = useState(initialTemplateName);
  const finalizedName = useMemo(() => templateName.trim(), [templateName]);

  const markDraftSaved = useCallback(() => {
    setIsDraftSaved(true);
  }, []);

  const openNameStep = useCallback(() => {
    setIsNameStepOpen(true);
  }, []);

  const closeNameStep = useCallback(() => {
    setIsNameStepOpen(false);
  }, []);

  const resetFlow = useCallback((nextTemplateName = '') => {
    setIsDraftSaved(false);
    setIsNameStepOpen(false);
    setTemplateName(nextTemplateName);
  }, []);

  const syncTemplateName = useCallback((nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    setTemplateName((previous) => (previous === trimmed ? previous : trimmed));
  }, []);

  const clearDraftProgress = useCallback(() => {
    setIsDraftSaved(false);
    setIsNameStepOpen(false);
  }, []);

  return {
    clearDraftProgress,
    finalizedName,
    isDraftSaved,
    isNameStepOpen,
    markDraftSaved,
    openNameStep,
    closeNameStep,
    resetFlow,
    setTemplateName,
    syncTemplateName,
    templateName,
  };
}

export function useLayoutEditorScrollLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [enabled]);
}
