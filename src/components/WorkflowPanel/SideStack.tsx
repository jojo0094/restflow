import React, { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  children?: React.ReactNode;
  initialWidth?: number;
  side?: "left" | "right";
}

export default function SideStack({
  name,
  children,
  initialWidth = 220,
  side = "left",
}: Props) {
  const [width, setWidth] = useState(initialWidth);
  const resizingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!resizingRef.current || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      let newWidth = width;
      if (side === "left") {
        newWidth = Math.max(60, e.clientX - rect.left);
      } else {
        const parentRect =
          rootRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          newWidth = Math.max(60, parentRect.right - e.clientX);
        }
      }
      setWidth(Math.min(520, newWidth));
    }

    function onPointerUp() {
      resizingRef.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [width, side]);

  function startResize() {
    resizingRef.current = true;
  }

  return (
    <div
      ref={rootRef}
      className={`side-stack side-stack-${name}`}
      style={{
        width,
        transition: resizingRef.current ? "none" : "width 160ms ease",
        overflow: "hidden",
        borderRight: side === "left" ? "1px solid #e5e7eb" : undefined,
        borderLeft: side === "right" ? "1px solid #e5e7eb" : undefined,
      }}
    >
      <div
        className="resize-handle"
        onPointerDown={startResize}
        style={{
          width: 8,
          cursor: "col-resize",
          position: "absolute",
          top: 0,
          bottom: 0,
          [side === "left" ? "right" : "left"]: 0,
        }}
      />
      {children}
    </div>
  );
}
