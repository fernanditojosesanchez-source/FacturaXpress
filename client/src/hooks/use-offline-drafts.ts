import { useState, useEffect, useCallback } from "react";

const DRAFTS_KEY = "dte-sv-drafts";
const SYNC_STATUS_KEY = "dte-sv-sync-status";

export interface OfflineDraft {
  id: string;
  type: "factura" | "nota";
  data: any;
  createdAt: string;
  lastModified: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingDrafts: number;
  lastSync: string | null;
}

export function useOfflineDrafts() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const stored = localStorage.getItem(DRAFTS_KEY);
    if (stored) {
      try {
        setDrafts(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading drafts:", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveDraft = useCallback((type: "factura" | "nota", data: any, existingId?: string) => {
    const now = new Date().toISOString();
    const id = existingId || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const draft: OfflineDraft = {
      id,
      type,
      data,
      createdAt: existingId ? drafts.find(d => d.id === existingId)?.createdAt || now : now,
      lastModified: now,
    };

    setDrafts((prev) => {
      const existing = prev.findIndex((d) => d.id === id);
      let updated: OfflineDraft[];
      
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = draft;
      } else {
        updated = [...prev, draft];
      }
      
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      return updated;
    });

    return id;
  }, [drafts]);

  const getDraft = useCallback((id: string) => {
    return drafts.find((d) => d.id === id);
  }, [drafts]);

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDrafts([]);
    localStorage.removeItem(DRAFTS_KEY);
  }, []);

  const getSyncStatus = useCallback((): SyncStatus => {
    const storedStatus = localStorage.getItem(SYNC_STATUS_KEY);
    const lastSync = storedStatus ? JSON.parse(storedStatus).lastSync : null;
    
    return {
      isOnline,
      pendingDrafts: drafts.length,
      lastSync,
    };
  }, [isOnline, drafts.length]);

  const updateLastSync = useCallback(() => {
    const status = { lastSync: new Date().toISOString() };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
  }, []);

  return {
    drafts,
    isOnline,
    saveDraft,
    getDraft,
    deleteDraft,
    clearAllDrafts,
    getSyncStatus,
    updateLastSync,
  };
}

export function useAutoSaveDraft(
  type: "factura" | "nota",
  formData: any,
  enabled: boolean = true,
  debounceMs: number = 2000
) {
  const { saveDraft, isOnline } = useOfflineDrafts();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || !formData) return;

    const timer = setTimeout(() => {
      const id = saveDraft(type, formData, draftId || undefined);
      if (!draftId) {
        setDraftId(id);
      }
      setLastSaved(new Date());
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, enabled, debounceMs, type, saveDraft, draftId]);

  return {
    draftId,
    lastSaved,
    isOnline,
  };
}
