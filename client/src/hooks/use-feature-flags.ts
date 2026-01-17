import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook para obtener todos los feature flags del usuario actual
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ["/api/feature-flags/my-flags"],
    queryFn: async () => {
      const response = await fetch("/api/feature-flags/my-flags", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error obteniendo feature flags");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 5 * 60 * 1000, // Re-fetch cada 5 minutos
  });
}

/**
 * Hook para verificar si un feature específico está habilitado
 */
export function useFeature(flagKey: string): boolean {
  const { data } = useFeatureFlags();
  return data?.flags?.[flagKey] ?? false;
}

/**
 * Hook para obtener múltiples features de una vez
 */
export function useFeatures(flagKeys: string[]): Record<string, boolean> {
  const { data } = useQuery({
    queryKey: ["/api/feature-flags/evaluate-bulk", flagKeys],
    queryFn: async () => {
      const response = await fetch("/api/feature-flags/evaluate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagKeys }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error evaluando feature flags");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: flagKeys.length > 0,
  });

  return data?.flags ?? {};
}

/**
 * Hook para obtener configuración de un feature
 */
export function useFeatureConfig(flagKey: string): any {
  const { data } = useQuery({
    queryKey: ["/api/feature-flags/evaluate-bulk", [flagKey]],
    queryFn: async () => {
      const response = await fetch("/api/feature-flags/evaluate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagKeys: [flagKey] }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error evaluando feature flag");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return data?.configs?.[flagKey];
}

/**
 * Hook para administradores: obtener todos los flags
 */
export function useAdminFeatureFlags() {
  return useQuery({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => {
      const response = await fetch("/api/admin/feature-flags", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error obteniendo feature flags");
      return response.json();
    },
  });
}

/**
 * Hook para obtener un flag específico (admin)
 */
export function useAdminFeatureFlag(flagKey: string) {
  return useQuery({
    queryKey: ["/api/admin/feature-flags", flagKey],
    queryFn: async () => {
      const response = await fetch(`/api/admin/feature-flags/${flagKey}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error obteniendo feature flag");
      return response.json();
    },
    enabled: !!flagKey,
  });
}

/**
 * Hook para crear/actualizar un feature flag
 */
export function useUpsertFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      data,
      isNew,
    }: {
      key: string;
      data: any;
      isNew: boolean;
    }) => {
      const url = isNew
        ? "/api/admin/feature-flags"
        : `/api/admin/feature-flags/${key}`;
      const method = isNew ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error guardando feature flag");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags/my-flags"] });
    },
  });
}

/**
 * Hook para toggle rápido de un flag
 */
export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagKey: string) => {
      const response = await fetch(`/api/admin/feature-flags/${flagKey}/toggle`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error actualizando feature flag");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags/my-flags"] });
    },
  });
}

/**
 * Hook para incrementar rollout gradual
 */
export function useIncrementRollout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flagKey,
      incremento = 10,
    }: {
      flagKey: string;
      incremento?: number;
    }) => {
      const response = await fetch(
        `/api/admin/feature-flags/${flagKey}/increment-rollout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incremento }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error incrementando rollout");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
    },
  });
}

/**
 * Hook para obtener historial de cambios
 */
export function useFeatureFlagHistory(flagKey: string) {
  return useQuery({
    queryKey: ["/api/admin/feature-flags", flagKey, "history"],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/feature-flags/${flagKey}/history`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Error obteniendo historial");
      return response.json();
    },
    enabled: !!flagKey,
  });
}

/**
 * Hook para obtener estadísticas de uso
 */
export function useFeatureFlagStats(flagKey: string, days: number = 7) {
  return useQuery({
    queryKey: ["/api/admin/feature-flags", flagKey, "stats", days],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/feature-flags/${flagKey}/stats?days=${days}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Error obteniendo estadísticas");
      return response.json();
    },
    enabled: !!flagKey,
  });
}
