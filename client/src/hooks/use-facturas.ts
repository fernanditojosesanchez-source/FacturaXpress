import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Factura } from "@shared/schema";
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

export function useFacturas(initialPage = 1, initialLimit = 25) {
  const { toast } = useToast();
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const query = useQuery<PaginatedResponse<Factura>>({
    queryKey: ["/api/facturas", page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/facturas?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error fetching invoices");
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facturas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facturas"] });
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido removida exitosamente.",
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
    facturas: query.data?.data ?? EMPTY_ARRAY,
    pagination: query.data?.pagination ?? { page, limit, total: 0, pages: 0 },
    isLoading: query.isLoading,
    error: query.error,
    page,
    setPage,
    limit,
    setLimit,
    deleteFactura: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
