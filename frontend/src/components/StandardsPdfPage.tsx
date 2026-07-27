"use client";

import { useEffect, useRef, useState } from "react";

import { STANDARDS_PDF_PATH } from "@/lib/standards";

type HighlightBox = { left: number; top: number; width: number; height: number };

interface StandardsPdfPageProps {
  pageNumber: number;
  /** Exact text to locate and highlight on the page. */
  highlightText?: string | null;
  title: string;
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function findHighlightBoxes(
  viewportWidth: number,
  viewportHeight: number,
  transform: number[],
  utilTransform: (m1: number[], m2: number[]) => number[],
  items: Array<{
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
  }>,
  needle: string,
): HighlightBox[] {
  const target = compactText(needle);
  if (!target) return [];

  const pieces: { start: number; end: number; index: number }[] = [];
  let haystack = "";

  items.forEach((item, index) => {
    const chunk = compactText(item.str ?? "");
    if (!chunk) return;
    const start = haystack.length;
    haystack += chunk;
    pieces.push({ start, end: haystack.length, index });
  });

  const matchAt = haystack.indexOf(target);
  if (matchAt < 0) return [];
  const matchEnd = matchAt + target.length;

  const matchedIndexes = pieces
    .filter((piece) => piece.end > matchAt && piece.start < matchEnd)
    .map((piece) => piece.index);

  const boxes: HighlightBox[] = [];
  for (const index of matchedIndexes) {
    const item = items[index];
    if (!item?.transform || item.width == null) continue;
    const tx = utilTransform(transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || item.height || 12;
    const width =
      (item.width || 0) * Math.hypot(tx[0], tx[1]) || fontHeight * 0.5;
    const left = tx[4];
    // PDF y is baseline; convert into CSS top-left space.
    const top = tx[5] - fontHeight;
    boxes.push({
      left,
      top: Math.max(0, top),
      width: Math.max(width, 4),
      height: Math.max(fontHeight * 1.15, 10),
    });
  }

  return boxes.map((b) => ({
    left: Math.min(Math.max(b.left, 0), viewportWidth),
    top: Math.min(Math.max(b.top, 0), viewportHeight),
    width: Math.min(b.width, viewportWidth - Math.max(b.left, 0)),
    height: Math.min(b.height, viewportHeight - Math.max(b.top, 0)),
  }));
}

export function StandardsPdfPage({
  pageNumber,
  highlightText,
  title,
}: StandardsPdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let destroyPdf: (() => Promise<void>) | null = null;

    async function render() {
      setLoading(true);
      setError(null);
      setBoxes([]);

      try {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        // Legacy build includes polyfills for Map.getOrInsertComputed / Promise.withResolvers.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument(STANDARDS_PDF_PATH);
        const pdf = await loadingTask.promise;
        destroyPdf = () => pdf.destroy();
        if (cancelled) return;

        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const cssWidth = container.clientWidth || baseViewport.width;
        const scale = cssWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas not available");
        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        await page.render({
          canvasContext: context,
          canvas,
          viewport,
          transform,
        }).promise;
        if (cancelled) return;

        setSize({ width: viewport.width, height: viewport.height });

        if (highlightText) {
          const textContent = await page.getTextContent();
          const items = textContent.items as Array<{
            str?: string;
            transform?: number[];
            width?: number;
            height?: number;
          }>;
          const nextBoxes = findHighlightBoxes(
            viewport.width,
            viewport.height,
            viewport.transform,
            (m1, m2) => pdfjs.Util.transform(m1, m2),
            items,
            highlightText,
          );
          if (!cancelled) setBoxes(nextBoxes);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void render();

    return () => {
      cancelled = true;
      void destroyPdf?.();
    };
  }, [pageNumber, highlightText]);

  useEffect(() => {
    if (boxes.length === 0) return;
    highlightRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [boxes]);

  return (
    <div ref={containerRef} className="relative w-full">
      {loading ? (
        <p className="absolute inset-x-0 top-8 z-10 text-center text-sm text-icta-gray-600">
          Loading page {pageNumber}…
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red">
          {error}
        </p>
      ) : null}
      <div
        className="relative mx-auto overflow-auto rounded-md border border-icta-gray-200 bg-icta-gray-50"
        style={{ maxHeight: "min(80vh, 900px)" }}
      >
        <div
          className="relative mx-auto"
          style={{ width: size.width || "100%", height: size.height || "auto" }}
        >
          <canvas ref={canvasRef} title={title} className="block w-full" />
          {boxes.map((box, i) => (
            <div
              key={`${box.left}-${box.top}-${i}`}
              ref={i === 0 ? highlightRef : undefined}
              aria-hidden
              className="pointer-events-none absolute rounded-sm bg-icta-green/35 ring-2 ring-icta-green"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
