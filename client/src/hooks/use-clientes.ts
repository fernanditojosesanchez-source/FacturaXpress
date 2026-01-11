import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Receptor } from "@shared/schema";
import { useToast } from "./use-toast";

export function useClientes() {
  const { toast } = useToast();

  const query = useQuery<Receptor[]>({
    queryKey: ["/api/receptores"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Receptor> }) => {
      const res = await apiRequest("PATCH", `/api/receptores/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receptores"] });
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente han sido guardados correctamente.",
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
      await apiRequest("DELETE", `/api/receptores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receptores"] });
      toast({
        title: "Cliente eliminado",
        description: "El registro ha sido removido del catálogo.",
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
    clientes: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    updateCliente: updateMutation.mutateAsync,
    deleteCliente: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
