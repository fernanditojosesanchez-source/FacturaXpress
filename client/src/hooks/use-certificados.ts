import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Certificado } from "@shared/schema";

interface CreateCertificadoData {
  nombre: string;
  archivo: string; // Base64 del P12
  contrasena: string;
  esProductivo?: boolean;
}

interface UpdateCertificadoData {
  nombre?: string;
  estado?: string;
  activo?: boolean;
  esProductivo?: boolean;
}

async function apiRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error en la solicitud");
  }

  return response.json();
}

export function useCertificados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: certificados = [], isLoading, isError } = useQuery({
    queryKey: ["certificados"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/certificados");
    },
    staleTime: 1000 * 60 * 10, // 10 minutos (más que antes)
    gcTime: 1000 * 60 * 15,    // Mantener en caché 15 minutos
    refetchOnWindowFocus: false, // No refetch al cambiar pestaña
    refetchOnReconnect: "stale",  // Solo refetch si está stale
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCertificadoData) => {
      return await apiRequest("POST", "/api/certificados", {
        nombre: data.nombre,
        archivo: data.archivo,
        contrasena: data.contrasena,
        esProductivo: data.esProductivo ?? false,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      toast({
        title: "Éxito",
        description: "Certificado cargado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCertificadoData }) => {
      return await apiRequest("PATCH", `/api/certificados/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      toast({
        title: "Éxito",
        description: "Certificado actualizado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/certificados/${id}`);
    },
    onMutate: (id: string) => {
      // Optimistic update: remover del caché antes de respuesta del servidor
      queryClient.setQueryData(["certificados"], (old: Certificado[]) =>
        old.filter(c => c.id !== id)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      toast({
        title: "Éxito",
        description: "Certificado eliminado",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] }); // Revertir optimistic update
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validarMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/certificados/${id}/validar`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      if (data.certificadoValido) {
        toast({
          title: "Validación exitosa",
          description: "El certificado es válido",
        });
      } else {
        toast({
          title: "Validación fallida",
          description: "El certificado contiene errores",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activarMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/certificados/${id}/activar`);
    },
    onMutate: (id: string) => {
      // Optimistic update: cambiar estado de certificados sin esperar servidor
      queryClient.setQueryData(["certificados"], (old: Certificado[]) =>
        old.map(c => 
          c.id === id 
            ? { ...c, activo: true, estado: "activo" } 
            : { ...c, activo: false }
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      toast({
        title: "Éxito",
        description: "Certificado activado como principal",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] }); // Revertir optimistic update
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    certificados,
    isLoading,
    isError,
    createCertificado: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateCertificado: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteCertificado: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    validarCertificado: validarMutation.mutateAsync,
    isValidating: validarMutation.isPending,
    activarCertificado: activarMutation.mutateAsync,
    isActivating: activarMutation.isPending,
  };
}
