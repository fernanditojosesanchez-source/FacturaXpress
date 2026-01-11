import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface AnulacionPendiente {
  id: string;
  facturaId: string;
  codigoGeneracion: string;
  motivo: string;
  estado: "pendiente" | "procesando" | "aceptado" | "error";
  intentosFallidos: number;
  createdAt: string;
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
        throw new Error("Failed to fetch pending anulaciones");
      }

      return response.json() as Promise<AnulacionPendiente[]>;
    },
    refetchInterval: 5000, // Refetch every 5 seconds
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
        throw new Error("Failed to fetch anulaciones history");
      }

      return response.json() as Promise<AnulacionHistorico[]>;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
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
