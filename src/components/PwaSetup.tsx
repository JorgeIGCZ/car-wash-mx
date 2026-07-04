"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function PwaSetup() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // La app sigue funcionando normalmente si el navegador bloquea el registro.
      });
    }

    if (isStandalone()) {
      return;
    }

    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    function captureInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function clearInstallPrompt() {
      setInstallPrompt(null);
      setShowIosHelp(false);
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowIosHelp(true);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!installPrompt && !isIos) {
    return null;
  }

  return (
    <aside className="pwa-install" aria-live="polite">
      {showIosHelp ? (
        <div className="pwa-install-help">
          <Share size={18} aria-hidden="true" />
          <p>
            En Safari toca <strong>Compartir</strong> y luego{" "}
            <strong>Agregar a inicio</strong>.
          </p>
          <button
            type="button"
            onClick={() => setShowIosHelp(false)}
            aria-label="Cerrar instrucciones"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button className="pwa-install-button" type="button" onClick={install}>
          <Download size={18} aria-hidden="true" />
          Instalar app
        </button>
      )}
    </aside>
  );
}
