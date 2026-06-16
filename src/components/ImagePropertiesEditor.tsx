import { useState, useEffect, useCallback, useRef } from "react";
import { useSchematicStore } from "../store";
import type { ImageNodeData, SchematicNode } from "../types";

const UNITS = ["ft", "in", "m", "cm", "mm"];

interface Pt { x: number; y: number }

/** Sub-modal: draw a line across the image and enter its real length to derive scale. */
function CalibrationModal({
  src,
  naturalWidth,
  naturalHeight,
  initialUnit,
  onCancel,
  onApply,
}: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  initialUnit: string;
  onCancel: () => void;
  onApply: (pxPerUnit: number, unit: string) => void;
}) {
  const [a, setA] = useState<Pt | null>(null);
  const [b, setB] = useState<Pt | null>(null);
  const [knownLength, setKnownLength] = useState("");
  const [unit, setUnit] = useState(initialUnit || "ft");
  const imgRef = useRef<HTMLImageElement>(null);

  // Fit the image into a max display box while preserving aspect ratio.
  const maxBox = 460;
  const scale = Math.min(maxBox / naturalWidth, maxBox / naturalHeight, 1);
  const dispW = Math.max(1, Math.round(naturalWidth * scale));
  const dispH = Math.max(1, Math.round(naturalHeight * scale));

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!a || (a && b)) {
      setA(pt);
      setB(null);
    } else {
      setB(pt);
    }
  };

  // Display-space line length → natural-pixel length.
  const dispLen = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  const naturalLen = dispW > 0 ? dispLen * (naturalWidth / dispW) : 0;
  const lengthNum = parseFloat(knownLength);
  const valid = a && b && dispLen > 2 && lengthNum > 0;
  const pxPerUnit = valid ? naturalLen / lengthNum : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl flex flex-col max-w-[90vw]">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-heading)]">Calibrate Scale</h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Click two points spanning a known distance, then enter its real length.
          </p>
        </div>

        <div className="p-4 flex flex-col items-center gap-3">
          <div
            className="relative cursor-crosshair select-none"
            style={{ width: dispW, height: dispH }}
            onClick={handleClick}
          >
            <img ref={imgRef} src={src} width={dispW} height={dispH} alt="" draggable={false} className="block" />
            <svg className="absolute inset-0 pointer-events-none" width={dispW} height={dispH}>
              {a && b && (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth={2} />
              )}
              {a && <circle cx={a.x} cy={a.y} r={4} fill="#ef4444" />}
              {b && <circle cx={b.x} cy={b.y} r={4} fill="#ef4444" />}
            </svg>
          </div>

          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Known length</span>
            <input
              type="number"
              min={0}
              step="any"
              value={knownLength}
              onChange={(e) => setKnownLength(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="e.g. 10"
              className="w-24 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-heading)] outline-none focus:border-blue-500"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-heading)] outline-none focus:border-blue-500 cursor-pointer"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {valid && (
              <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                {pxPerUnit.toFixed(1)} px/{unit}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:text-[var(--color-text-heading)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onApply(pxPerUnit, unit)}
            disabled={!valid}
            className="px-3 py-1.5 text-xs rounded border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply Scale
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImagePropertiesEditor() {
  const editingNodeId = useSchematicStore((s) => s.editingNodeId);
  const activePage = useSchematicStore((s) => s.activePage);
  const nodes = useSchematicStore((s) => s.nodes);
  const pages = useSchematicStore((s) => s.pages);
  const updateImageNode = useSchematicStore((s) => s.updateImageNode);
  const setEditingNodeId = useSchematicStore((s) => s.setEditingNodeId);

  // Resolve the edited node from the schematic (global) or the active floorplan page.
  let node: SchematicNode | undefined;
  if (activePage === "schematic") {
    node = nodes.find((n) => n.id === editingNodeId && n.type === "image");
  } else {
    const page = pages.find((p) => p.id === activePage && p.type === "floorplan");
    node = page?.type === "floorplan" ? page.nodes.find((n) => n.id === editingNodeId && n.type === "image") : undefined;
  }
  const data = node?.data as ImageNodeData | undefined;

  const [opacity, setOpacity] = useState(100);
  const [lockAspect, setLockAspect] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pxPerUnit, setPxPerUnit] = useState<number | undefined>(undefined);
  const [unitLabel, setUnitLabel] = useState<string | undefined>(undefined);
  const [showCalibrate, setShowCalibrate] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!node) return;
    const d = node.data as ImageNodeData;
    setOpacity(d.opacity ?? 100);
    setLockAspect(d.lockAspect ?? true);
    setLocked(d.locked ?? false);
    setPxPerUnit(d.pxPerUnit);
    setUnitLabel(d.unitLabel);
    setShowCalibrate(false);
  }, [node]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const close = useCallback(() => setEditingNodeId(null), [setEditingNodeId]);

  const handleSave = useCallback(() => {
    if (!editingNodeId) return;
    updateImageNode(editingNodeId, {
      opacity,
      lockAspect,
      locked: locked || undefined,
      pxPerUnit,
      unitLabel,
    });
    close();
  }, [editingNodeId, opacity, lockAspect, locked, pxPerUnit, unitLabel, updateImageNode, close]);

  if (!editingNodeId || !node || !data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl w-[340px] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-heading)]">Image Properties</h2>
          <button
            onClick={close}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="flex justify-center bg-[var(--color-surface)] rounded border border-[var(--color-border)] p-2">
            <img src={data.src} alt="" className="max-h-28 max-w-full object-contain" style={{ opacity: opacity / 100 }} />
          </div>

          {/* Opacity */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={100} step={5}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="flex-1 h-1.5 cursor-pointer accent-blue-500"
              />
              <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right">{opacity}%</span>
            </div>
          </div>

          {/* Scale calibration */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Scale</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCalibrate(true)}
                className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:text-[var(--color-text-heading)] cursor-pointer"
              >
                Calibrate scale…
              </button>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {pxPerUnit && unitLabel ? `${pxPerUnit.toFixed(1)} px/${unitLabel}` : "Not set"}
              </span>
              {pxPerUnit != null && (
                <button
                  onClick={() => { setPxPerUnit(undefined); setUnitLabel(undefined); }}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} className="accent-blue-500 cursor-pointer" />
              Lock aspect ratio
              <span className="text-[10px] text-[var(--color-text-muted)]">(or hold Shift while resizing)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text)] cursor-pointer">
              <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="accent-blue-500 cursor-pointer" />
              Lock position
            </label>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            onClick={close}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:text-[var(--color-text-heading)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs rounded border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {showCalibrate && (
        <CalibrationModal
          src={data.src}
          naturalWidth={data.naturalWidth}
          naturalHeight={data.naturalHeight}
          initialUnit={unitLabel ?? "ft"}
          onCancel={() => setShowCalibrate(false)}
          onApply={(ppu, unit) => { setPxPerUnit(ppu); setUnitLabel(unit); setShowCalibrate(false); }}
        />
      )}
    </div>
  );
}
