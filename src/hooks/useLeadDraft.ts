import { useEffect, useRef } from 'react';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import type { CreateLeadInput } from '../domain/lead/lead';
import { useServices } from './useServices';

function isSameDraft(left: CreateLeadInput, right: CreateLeadInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isLeadFormDirty(values: CreateLeadInput): boolean {
  return !isSameDraft(values, DEFAULT_CREATE_LEAD_INPUT);
}

interface UseLeadDraftOptions {
  userId: string | undefined;
  values: CreateLeadInput;
  setValues: (values: CreateLeadInput) => void;
  onDraftRestored: () => void;
}

export function useLeadDraft({
  userId,
  values,
  setValues,
  onDraftRestored,
}: UseLeadDraftOptions) {
  const { leadDraftService } = useServices();
  const hasLoadedDraft = useRef(false);

  useEffect(() => {
    if (!userId || hasLoadedDraft.current) {
      return;
    }

    hasLoadedDraft.current = true;

    void leadDraftService.getDraft(userId).then((draft) => {
      if (draft) {
        setValues(draft);
        onDraftRestored();
      }
    });
  }, [userId, leadDraftService, setValues, onDraftRestored]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void leadDraftService.saveDraft(userId, values);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [userId, values, leadDraftService]);
}
