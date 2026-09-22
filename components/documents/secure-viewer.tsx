"use client";

import { useEffect, useRef } from "react";
import { Shield } from "lucide-react";
import { documentTypeLabel } from "@/lib/documents/mime";

export function WatermarkOverlay({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(127, 29, 29, 0.16)";
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.PI / 6);
      for (let y = -height; y < height * 2; y += 64) {
        for (let x = -width; x < width * 2; x += 280) {
          ctx.fillText(text, x - width / 2, y - height / 2);
        }
      }
      ctx.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    window.addEventListener("beforeprint", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", draw);
    };
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 select-none print:block"
    />
  );
}

export function SecureViewer({
  documentId,
  mimeType,
  title,
  watermark,
}: {
  documentId: string;
  mimeType: string;
  title: string;
  watermark: string;
}) {
  const src = `/api/files/${documentId}`;
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-sm font-medium">Aperçu {documentTypeLabel(mimeType)}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">Filigrane de consultation actif</p>
      </div>
      <div className="document-workspace relative min-h-[70vh] overflow-hidden">
        <div className="select-none">
          {isPdf ? (
            <iframe title={`Prévisualisation ${title}`} src={src} className="h-[70vh] w-full bg-transparent" />
          ) : isImage ? (
            <div className="flex min-h-[70vh] items-center justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="max-h-[66vh] rounded-lg object-contain shadow-md" />
            </div>
          ) : (
            <p className="p-8 text-sm text-muted-foreground">Aperçu indisponible pour ce type de fichier.</p>
          )}
        </div>
        <WatermarkOverlay text={watermark} />
        <p className="sr-only">{watermark}</p>
      </div>
    </div>
  );
}
