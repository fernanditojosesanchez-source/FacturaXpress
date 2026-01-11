import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";

type MeResponse = { 
  user?: { 
    id: string; 
    username: string; 
    tenantId?: string;
    role?: string;
  } 
};

export function useAuth() {
  const qc = useQueryClient();
  const [_, navigate] = useLocation();

  const me = useQuery<MeResponse | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useMutation({
    mutationFn: async (vars: { usernameOrEmail: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Error de inicio de sesión");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/");
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Error al cerrar sesión");
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/login");
    },
  });

  return {
    user: (me.data as MeResponse | null)?.user,
    isAuthenticated: !!(me.data as MeResponse | null)?.user,
    isLoading: me.isLoading,
    login,
    logout,
  };
}
