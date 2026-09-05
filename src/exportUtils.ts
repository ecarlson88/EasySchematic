import { type ReactFlowInstance, getViewportForBounds } from "@xyflow/react";
import { toBlob, toSvg } from "html-to-image";
import { freezeSvgColors } from "./freezeSvgColors";

const EXPORT_PADDING = 40;
// Cap the raster so a large schematic can't demand a multi-gigapixel canvas —
// pixelRatio 4 over the full bounds was allocating GBs and near-crashing 8GB
// machines (#383). Per-side cap matches pdfExport.ts; the area cap additionally
// bounds layouts that are big in BOTH dimensions (12000×12000 alone would be a
// 576MB bitmap). The ratio may fall below 1 for outsized schematics: capping the
// output is the point.
const MAX_RASTER_DIMENSION_PX = 12000;
const MAX_RASTER_AREA_PX = 64_000_000;

interface ExportOptions {
  pixelRatio?: number;
  format?: "png" | "svg";
  backgroundColor?: string;
}

export async function exportImage(
  reactFlowInstance: ReactFlowInstance,
  options: ExportOptions = {},
) {
  const {
    pixelRatio = 3,
    format = "png",
    backgroundColor = "#ffffff",
  } = options;

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) return;

  const bounds = reactFlowInstance.getNodesBounds(nodes);

  // Target dimensions with padding
  const width = bounds.width + EXPORT_PADDING * 2;
  const height = bounds.height + EXPORT_PADDING * 2;

  // Compute viewport that fits all nodes into our export area
  const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, 0);

  const viewportEl = document.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement;
  if (!viewportEl) return;

  const effectivePixelRatio = Math.min(
    pixelRatio,
    MAX_RASTER_DIMENSION_PX / Math.max(width, height),
    Math.sqrt(MAX_RASTER_AREA_PX / (width * height)),
  );

  // Firefox returns `undefined` from getPropertyValue() for unrecognized CSS
  // properties, but html-to-image calls .trim() on the result without a null
  // check. Patch it to return '' instead while html-to-image runs.
  const origGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  CSSStyleDeclaration.prototype.getPropertyValue = function (prop) {
    return origGetPropertyValue.call(this, prop) ?? '';
  };

  // Force light-mode colors during capture — see [data-export-capturing] in index.css
  document.documentElement.setAttribute("data-export-capturing", "");
  // Let the style override flush before html-to-image reads computed styles
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  // Freeze var(--color-…) strokes to concrete colors so Chromium's html-to-image
  // clone keeps the connection lines (#173).
  const restoreColors = freezeSvgColors(viewportEl);

  // Download from a Blob, never a base64 data URL: the URL doubles the image in
  // memory as a giant string, and Chrome silently drops data-URL downloads past
  // ~2MB — both bite on exactly the large schematics of #383.
  let blob: Blob | null;
  try {
    const captureOptions = {
      backgroundColor,
      width,
      height,
      pixelRatio: format === "svg" ? 1 : effectivePixelRatio,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    };
    if (format === "svg") {
      const dataUrl = await toSvg(viewportEl, captureOptions);
      const svgText = decodeURIComponent(
        dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""),
      );
      blob = new Blob([svgText], { type: "image/svg+xml" });
    } else {
      blob = await toBlob(viewportEl, captureOptions);
    }
  } finally {
    restoreColors();
    CSSStyleDeclaration.prototype.getPropertyValue = origGetPropertyValue;
    document.documentElement.removeAttribute("data-export-capturing");
  }
  if (!blob) return;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `schematic.${format}`;
  link.href = url;
  link.click();
  // The click only queues the download; revoke after it has been picked up.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
