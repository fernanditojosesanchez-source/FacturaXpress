import { useOnlineStatus } from "@/hooks/use-online-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Mostrar mensaje de reconexión
      setShowReconnected(true);
      setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      {!isOnline ? (
        <Alert className="border-amber-500 bg-amber-50 text-amber-900">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Modo sin conexión</strong>
            <br />
            Los datos se sincronizarán cuando vuelvas a estar en línea.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-500 bg-green-50 text-green-900">
          <Wifi className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Conectado</strong>
            <br />
            Sincronizando datos...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
