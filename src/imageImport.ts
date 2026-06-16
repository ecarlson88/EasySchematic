/** Shared helpers for importing a floorplan/reference image as a data URL.
 *  Mirrors the FileReader + canvas-resize pattern in TitleBlockDialog, but
 *  generalized for full-page floorplan images (larger cap) and returns the
 *  natural dimensions so callers can seed an aspect-correct node size. */

/** Max edge (px) the imported image is downscaled to, to keep localStorage/JSON
 *  payloads reasonable. Floorplans need more detail than a logo, so this is large. */
const MAX_EDGE_PX = 4000;

/** Reject images larger than this raw file size before reading. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB

export interface ImportedImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Load a data URL into an Image, downscaling to MAX_EDGE_PX if needed.
 *  SVGs (which may report 0×0) are passed through untouched. */
function rasterize(dataUrl: string, isSvg: boolean): Promise<ImportedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || img.width;
      const h0 = img.naturalHeight || img.height;
      if (!w0 || !h0) {
        // Unknown intrinsic size (e.g. some SVGs) — keep as-is with a sane default.
        resolve({ src: dataUrl, naturalWidth: w0 || 1000, naturalHeight: h0 || 1000 });
        return;
      }
      const scale = Math.min(1, MAX_EDGE_PX / w0, MAX_EDGE_PX / h0);
      if (isSvg || scale >= 1) {
        resolve({ src: dataUrl, naturalWidth: w0, naturalHeight: h0 });
        return;
      }
      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve({ src: dataUrl, naturalWidth: w0, naturalHeight: h0 }); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ src: canvas.toDataURL("image/png"), naturalWidth: w, naturalHeight: h });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Read an image File and return a (possibly downscaled) data URL plus its
 *  natural dimensions. Throws if the file is too large or not an image. */
export async function importImageFile(file: File): Promise<ImportedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  return rasterize(dataUrl, file.type === "image/svg+xml");
}

/** Compute the initial on-canvas size for an imported image, fitting it within
 *  `maxEdge` flow-units while preserving aspect ratio. */
export function fitImageSize(naturalWidth: number, naturalHeight: number, maxEdge = 600): { width: number; height: number } {
  if (!naturalWidth || !naturalHeight) return { width: maxEdge, height: maxEdge };
  const scale = Math.min(1, maxEdge / naturalWidth, maxEdge / naturalHeight);
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}
