/**
 * Hook para detectar estado online/offline
 * y sincronizar borradores automáticamente
 */

import { useState, useEffect } from "react";
import { syncDrafts, getOfflineStats } from "../lib/offline-drafts";
import { useToast } from "./use-toast";

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  stats: {
    total: number;
    pending: number;
    synced: number;
    errors: number;
  } | null;
}

export function useOfflineSync() {
  const { toast } = useToast();
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    stats: null,
  });

  // Cargar estadísticas al montar
  useEffect(() => {
    getOfflineStats().then((stats) => {
      setState((prev) => ({ ...prev, stats }));
    });
  }, []);

  // Sincronizar cuando vuelve la conexión
  useEffect(() => {
    const handleOnline = async () => {
      console.log("[Offline] Conexión restaurada, sincronizando...");
      setState((prev) => ({ ...prev, isOnline: true, isSyncing: true }));

      toast({
        title: "Conexión restaurada",
        description: "Sincronizando borradores pendientes...",
      });

      try {
        const apiClient = {
          post: async (url: string, data: any) => {
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
              credentials: "include",
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
          },
        };

        const result = await syncDrafts(apiClient);

        if (result.synced > 0) {
          toast({
            title: "Sincronización completada",
            description: `${result.synced} borradores sincronizados`,
            variant: "default",
          });
        }

        if (result.errors > 0) {
          toast({
            title: "Errores en sincronización",
            description: `${result.errors} borradores fallaron`,
            variant: "destructive",
          });
        }

        // Actualizar estadísticas
        const stats = await getOfflineStats();
        setState((prev) => ({ ...prev, stats, isSyncing: false }));
      } catch (error: any) {
        console.error("[Offline] Error sincronizando:", error);
        toast({
          title: "Error de sincronización",
          description: error.message,
          variant: "destructive",
        });
        setState((prev) => ({ ...prev, isSyncing: false }));
      }
    };

    const handleOffline = () => {
      console.log("[Offline] Conexión perdida");
      setState((prev) => ({ ...prev, isOnline: false }));

      toast({
        title: "Sin conexión",
        description: "Trabajando en modo offline. Los cambios se sincronizarán al reconectar.",
        variant: "default",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  // Función manual de sincronización
  const triggerSync = async () => {
    if (!state.isOnline) {
      toast({
        title: "Sin conexión",
        description: "No se puede sincronizar sin conexión a Internet",
        variant: "destructive",
      });
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const apiClient = {
        post: async (url: string, data: any) => {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response.json();
        },
      };

      const result = await syncDrafts(apiClient);

      toast({
        title: "Sincronización completada",
        description: `${result.synced} sincronizados, ${result.errors} errores`,
      });

      const stats = await getOfflineStats();
      setState((prev) => ({ ...prev, stats, isSyncing: false }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  return {
    ...state,
    triggerSync,
  };
}
