import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Producto, type InsertProducto } from "@shared/schema";
import { useToast } from "./use-toast";

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const EMPTY_ARRAY: any[] = [];

export function useProductos(initialPage = 1, initialLimit = 25) {
  const { toast } = useToast();
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const query = useQuery<PaginatedResponse<Producto>>({
    queryKey: ["/api/productos", page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/productos?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error fetching products");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (producto: InsertProducto) => {
      const res = await apiRequest("POST", "/api/productos", producto);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productos"] });
      toast({
        title: "Producto creado",
        description: "El producto ha sido guardado exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear producto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProducto> }) => {
      const res = await apiRequest("PATCH", `/api/productos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productos"] });
      toast({
        title: "Producto actualizado",
        description: "Los cambios han sido guardados.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/productos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productos"] });
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido removido del catálogo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    productos: query.data?.data ?? EMPTY_ARRAY,
    pagination: query.data?.pagination ?? { page, limit, total: 0, pages: 0 },
    isLoading: query.isLoading,
    error: query.error,
    page,
    setPage,
    limit,
    setLimit,
    createProducto: createMutation.mutateAsync,
    updateProducto: updateMutation.mutateAsync,
    deleteProducto: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
