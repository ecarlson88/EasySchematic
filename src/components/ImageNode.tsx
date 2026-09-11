import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { ImageNodeData } from "../types";
import { useSchematicStore } from "../store";

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ImageNode({ id, data, selected }: NodeProps) {
  const imageData = data as unknown as ImageNodeData;
  const opacity = (imageData.opacity ?? 100) / 100;
  const locked = imageData.locked ?? false;
  const lockAspect = imageData.lockAspect ?? true;
  // Hold Shift during a resize to temporarily constrain to the natural aspect ratio.
  const shiftHeld = useSchematicStore((s) => s.shiftHeld);

  const handleDoubleClick = () => {
    useSchematicStore.getState().setEditingNodeId(id);
  };

  return (
    <>
      <NodeResizer
        isVisible={!!selected && !locked}
        keepAspectRatio={lockAspect || shiftHeld}
        minWidth={40}
        minHeight={40}
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#3b82f6" }}
      />
      <div
        style={{ position: "relative", width: "100%", height: "100%" }}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={imageData.src}
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "fill",
            opacity,
            pointerEvents: "none",
            userSelect: "none",
            border: selected ? "1px solid #3b82f6" : "none",
          }}
          alt=""
        />
        {/* Lock toggle — top-right corner, mirrors RoomNode */}
        <div
          className="absolute top-0 right-0 px-1.5 py-1 transition-opacity"
          style={{ pointerEvents: "auto", opacity: locked ? 1 : selected ? 0.6 : 0 }}
        >
          <button
            className="text-white drop-shadow cursor-pointer bg-black/30 rounded p-0.5 hover:bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              useSchematicStore.getState().toggleImageLock(id);
            }}
            title={locked ? "Unlock image" : "Lock image"}
          >
            {locked ? <LockIcon /> : <UnlockIcon />}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(ImageNode);
