import { useState } from "react";
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

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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

export function useCertificadosPaginated() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificados", page, limit],
    queryFn: async () => {
      return await apiRequest(
        "GET",
        `/api/certificados?page=${page}&limit=${limit}`
      );
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  }) as { data: PaginatedResponse<Certificado> | undefined; isLoading: boolean; isError: boolean };

  const certificados = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, pages: 0 };

  const createMutation = useMutation({
    mutationFn: async (dataCreate: CreateCertificadoData) => {
      return await apiRequest("POST", "/api/certificados", {
        nombre: dataCreate.nombre,
        archivo: dataCreate.archivo,
        contrasena: dataCreate.contrasena,
        esProductivo: dataCreate.esProductivo ?? false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      setPage(1); // Volver a página 1
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
    mutationFn: async ({ id, data: dataUpdate }: { id: string; data: UpdateCertificadoData }) => {
      return await apiRequest("PATCH", `/api/certificados/${id}`, dataUpdate);
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
      queryClient.setQueryData(
        ["certificados", page, limit],
        (old: PaginatedResponse<Certificado> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter(c => c.id !== id),
            pagination: {
              ...old.pagination,
              total: old.pagination.total - 1,
            },
          };
        }
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
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
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
      queryClient.setQueryData(
        ["certificados", page, limit],
        (old: PaginatedResponse<Certificado> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map(c =>
              c.id === id
                ? { ...c, activo: true, estado: "activo" }
                : { ...c, activo: false }
            ),
          };
        }
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
      queryClient.invalidateQueries({ queryKey: ["certificados"] });
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    certificados,
    pagination,
    isLoading,
    isError,
    page,
    setPage,
    limit,
    setLimit,
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
