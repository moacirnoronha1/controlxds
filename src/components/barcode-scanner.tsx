import { useEffect, useRef, useState } from "react";
type IScannerControls = { stop: () => void };
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|trás|rear|environment/i.test(d.label)) ?? devices[0];
        if (!back) throw new Error("Nenhuma câmera encontrada");
        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              controls.stop();
              setActive(false);
              onDetected(text);
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao acessar câmera");
        setActive(false);
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onDetected]);

  if (!active) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full" onClick={() => { setError(null); setActive(true); }}>
          <Camera className="h-4 w-4 mr-2" /> Escanear pela câmera
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-md overflow-hidden border border-border bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-primary/70 shadow-[0_0_8px_var(--primary)]" />
      </div>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setActive(false)}>
        <X className="h-4 w-4 mr-2" /> Cancelar leitura
      </Button>
    </div>
  );
}
