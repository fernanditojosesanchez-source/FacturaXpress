import { useEffect } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Configuración de NProgress
NProgress.configure({ 
  showSpinner: false,
  minimum: 0.15,
  easing: 'ease',
  speed: 500,
});

/**
 * Hook que muestra automáticamente barra de progreso
 * durante queries y mutations de TanStack Query
 */
export function useGlobalLoadingIndicator() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  
  useEffect(() => {
    if (isFetching > 0 || isMutating > 0) {
      NProgress.start();
    } else {
      NProgress.done();
    }
  }, [isFetching, isMutating]);
}
