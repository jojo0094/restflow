import { useEffect, useRef, useState } from "react";
import WorkflowCanvas from "../WorkflowCanvas";

export default function WorkflowPanel() {
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(220);
  const resizingRef = useRef(false);
  const sideRef = useRef("left");

  useEffect(() => {
    function onPointerMove(e) {
      if (!resizingRef.current) return;
      if (sideRef.current === "left") {
        setLeftWidth(Math.max(60, Math.min(520, e.clientX)));
      } else if (sideRef.current === "right") {
        const parentWidth = window.innerWidth;
        setRightWidth(Math.max(60, Math.min(520, parentWidth - e.clientX)));
      }
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
  }, []);

  function startResize(side) {
    return (e) => {
      resizingRef.current = true;
      sideRef.current = side;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  return (
    <div
      className="workflow-panel"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Left SideStack */}
      <div
        style={{
          width: leftWidth,
          transition: resizingRef.current ? "none" : "width 160ms ease",
          overflow: "hidden",
          borderRight: "1px solid #e5e7eb",
          position: "relative",
        }}
      >
        <div style={{ height: "100%", background: "#f3f4f6" }}>
          Left Stack Content
        </div>
        <div
          onPointerDown={startResize("left")}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 12,
            cursor: "col-resize",
            zIndex: 30,
          }}
        />
      </div>

      {/* WorkflowCanvas in the middle */}
      <div
        className="workflow-canvas"
        style={{ flex: 1, width: "100%", height: "100%", background: "white" }}
      >
        <WorkflowCanvas />
      </div>

      {/* Right SideStack */}
      <div
        style={{
          width: rightWidth,
          transition: resizingRef.current ? "none" : "width 160ms ease",
          overflow: "hidden",
          borderLeft: "1px solid #e5e7eb",
          position: "relative",
        }}
      >
        <div style={{ height: "100%", background: "#f3f4f6" }}>
          Right Stack Content
        </div>
        <div
          onPointerDown={startResize("right")}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 12,
            cursor: "col-resize",
            zIndex: 30,
          }}
        />
      </div>
    </div>
  );
}
