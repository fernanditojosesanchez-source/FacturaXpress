import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface AnulacionPendiente {
  id: string;
  facturaId: string;
  codigoGeneracion: string;
  motivo: string;
  estado: "pendiente" | "procesando" | "aceptado" | "error";
  intentosFallidos: number;
  fechaAnulo: string;
}

interface AnulacionHistorico extends AnulacionPendiente {
  selloAnulacion?: string;
  respuestaMH?: any;
  usuarioAnuloId?: string;
}

interface AnularDTERequest {
  motivo: string; // 01-05
}

interface AnularDTEResponse {
  id: string;
  estado: string;
  message: string;
}

export function useAnulacionesPendientes() {
  return useQuery({
    queryKey: ["anulaciones", "pendientes"],
    queryFn: async () => {
      const response = await fetch("/api/anulaciones/pendientes", {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[useAnulacionesPendientes] Error:", response.status, error);
        throw new Error(error.error || "Failed to fetch pending anulaciones");
      }

      const data = await response.json();
      return (data.anulaciones || []) as AnulacionPendiente[];
    },
    retry: false,
    refetchInterval: 5000,
  });
}

export function useAnulacionesHistorico(limit: number = 50) {
  return useQuery({
    queryKey: ["anulaciones", "historico", limit],
    queryFn: async () => {
      const response = await fetch(`/api/anulaciones/historico?limit=${limit}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[useAnulacionesHistorico] Error:", response.status, error);
        throw new Error(error.error || "Failed to fetch anulaciones history");
      }

      const data = await response.json();
      return (data.anulaciones || []) as AnulacionHistorico[];
    },
    retry: false,
    refetchInterval: 10000,
  });
}

export function useAnularDTE(facturaId: string) {
  return useMutation({
    mutationFn: async (request: AnularDTERequest) => {
      const response = await fetch(`/api/facturas/${facturaId}/invalidar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to anular DTE");
      }

      return response.json() as Promise<AnularDTEResponse>;
    },
    onSuccess: () => {
      // Invalidate both anulaciones queries
      queryClient.invalidateQueries({ queryKey: ["anulaciones"] });
      queryClient.invalidateQueries({ queryKey: ["facturas"] });
    },
  });
}

export function useProcesarAnulacionesPendientes() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/anulaciones/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process anulaciones");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anulaciones"] });
      queryClient.invalidateQueries({ queryKey: ["facturas"] });
    },
  });
}
