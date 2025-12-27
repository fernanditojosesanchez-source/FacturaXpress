import { useQuery } from "@tanstack/react-query";

export interface Catalogo {
  departamentos: Array<{ codigo: string; nombre: string }>;
  tiposDocumento: Array<{ codigo: string; nombre: string }>;
  tiposDte: Array<{ codigo: string; nombre: string }>;
  condicionesOperacion: Array<{ codigo: string; nombre: string }>;
  formasPago: Array<{ codigo: string; nombre: string }>;
  tiposItem: Array<{ codigo: string; nombre: string }>;
  unidadesMedida: Array<{ codigo: number; nombre: string }>;
}

export function useCatalogos() {
  return useQuery<Catalogo>({
    queryKey: ["/api/catalogos/all"],
    staleTime: 1000 * 60 * 60, // 1 hora
    refetchOnWindowFocus: false,
  });
}
