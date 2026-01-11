import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Producto, type InsertProducto } from "@shared/schema";
import { useToast } from "./use-toast";

export function useProductos() {
  const { toast } = useToast();

  const query = useQuery<Producto[]>({
    queryKey: ["/api/productos"],
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
    productos: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createProducto: createMutation.mutateAsync,
    updateProducto: updateMutation.mutateAsync,
    deleteProducto: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
