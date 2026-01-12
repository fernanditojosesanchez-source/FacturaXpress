import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker for PWA offline support
if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      const update = confirm(
        "Nueva versión disponible. ¿Deseas actualizar la aplicación?"
      );
      if (update) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log("✅ App lista para funcionar sin conexión");
    },
    onRegisterError(error) {
      console.error("❌ Error al registrar Service Worker:", error);
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
