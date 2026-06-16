import { useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";
import { useSchematicStore } from "../store";
import { nodeTypes } from "../nodeTypes";
import type { FloorplanPage } from "../types";
import { importImageFile, fitImageSize } from "../imageImport";

function FloorplanCanvasInner({ page }: { page: FloorplanPage }) {
  const onFloorplanNodesChange = useSchematicStore((s) => s.onFloorplanNodesChange);
  const addFloorplanImage = useSchematicStore((s) => s.addFloorplanImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => onFloorplanNodesChange(page.id, changes),
    [onFloorplanNodesChange, page.id]
  );

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const img = await importImageFile(file);
      const size = fitImageSize(img.naturalWidth, img.naturalHeight);
      // Drop at the center of the visible canvas.
      const rect = wrapperRef.current?.getBoundingClientRect();
      const center = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      addFloorplanImage(
        page.id,
        { x: center.x - size.width / 2, y: center.y - size.height / 2 },
        { src: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, opacity: 100, lockAspect: true },
        size
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not import image.");
    }
  }, [addFloorplanImage, page.id, screenToFlowPosition]);

  return (
    <div ref={wrapperRef} className="relative flex-1 h-full">
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-white shadow text-[var(--color-text)] hover:text-[var(--color-text-heading)] cursor-pointer"
        >
          + Add Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      <ReactFlow
        nodes={page.nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        fitView
        minZoom={0.05}
        elevateNodesOnSelect={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d4" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </div>
  );
}

/** Standalone canvas for the active floorplan page. Wrapped in its own
 *  ReactFlowProvider so its viewport is isolated from the schematic canvas. */
export default function FloorplanCanvas() {
  const activePage = useSchematicStore((s) => s.activePage);
  const page = useSchematicStore((s) => s.pages.find((p) => p.id === s.activePage));

  if (!page || page.type !== "floorplan") return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <ReactFlowProvider>
        {/* key by page id so switching floorplan tabs remounts with a fresh viewport */}
        <FloorplanCanvasInner key={activePage} page={page} />
      </ReactFlowProvider>
    </div>
  );
}
