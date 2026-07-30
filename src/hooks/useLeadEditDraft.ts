import { useEffect, useRef } from 'react';
import { isSameEditInput } from '../domain/lead/leadFormMapping';
import type { EditLeadInput } from '../domain/lead/lead';
import { useServices } from './useServices';

export function isEditFormDirty(values: EditLeadInput, baseline: EditLeadInput): boolean {
  return !isSameEditInput(values, baseline);
}

interface UseLeadEditDraftOptions {
  leadId: string | undefined;
  leadUpdatedAt: string | undefined;
  baseline: EditLeadInput;
  values: EditLeadInput;
  setValues: (values: EditLeadInput) => void;
  onDraftRestored: () => void;
}

export function useLeadEditDraft({
  leadId,
  leadUpdatedAt,
  baseline,
  values,
  setValues,
  onDraftRestored,
}: UseLeadEditDraftOptions) {
  const { leadEditDraftService } = useServices();
  const hasLoadedDraft = useRef(false);

  useEffect(() => {
    if (!leadId || !leadUpdatedAt || hasLoadedDraft.current) {
      return;
    }

    hasLoadedDraft.current = true;

    void leadEditDraftService.getDraft(leadId, leadUpdatedAt, baseline).then((draft) => {
      if (draft) {
        setValues(draft);
        onDraftRestored();
      }
    });
  }, [leadId, leadUpdatedAt, baseline, leadEditDraftService, setValues, onDraftRestored]);

  useEffect(() => {
    if (!leadId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void leadEditDraftService.saveDraft(leadId, values, baseline);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [leadId, values, baseline, leadEditDraftService]);
}
