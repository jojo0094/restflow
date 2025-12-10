import { useEffect, useRef, useState } from "react";
import WorkflowCanvas from "../WorkflowCanvas";
import { runWorkflow } from "../../lib/api";

export default function WorkflowPanel() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(leftOpen ? 220 : 40);
  const [rightWidth, setRightWidth] = useState(rightOpen ? 220 : 40);
  const resizingRef = useRef(false);
  const sideRef = useRef("left");

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
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

  function startResize(side: "left" | "right") {
    return (e: React.PointerEvent) => {
      resizingRef.current = true;
      sideRef.current = side;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  function toggleLeft() {
    setLeftOpen((prev) => !prev);
    setLeftWidth((prev) => (leftOpen ? 40 : 220));
  }

  function toggleRight() {
    setRightOpen((prev) => !prev);
    setRightWidth((prev) => (rightOpen ? 40 : 220));
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
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={toggleLeft}
            aria-label="Toggle Left Panel"
            style={{
              width: 40,
              height: 40,
              background: "#111827",
              color: "white",
              border: "none",
            }}
          >
            Left
          </button>
        </div>
        {leftOpen && (
          <div style={{ height: "100%", background: "#f3f4f6" }}>
            Left Stack Content
          </div>
        )}
        {leftOpen && (
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
        )}
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
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={toggleRight}
            aria-label="Toggle Right Panel"
            style={{
              width: 40,
              height: 40,
              background: "#111827",
              color: "white",
              border: "none",
            }}
          >
            Right
          </button>
        </div>
        {rightOpen && (
          <div style={{ height: "100%", background: "#f3f4f6", padding: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={async () => {
                  try {
                    const payload = { nodes: [], edges: [] };
                    const res = await runWorkflow(payload);
                    alert(`Workflow run result: ${JSON.stringify(res)}`);
                  } catch (err) {
                    alert(String(err));
                  }
                }}
                style={{ padding: '8px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 6 }}
              >
                Run Workflow
              </button>
            </div>
            Right Stack Content
          </div>
        )}
        {rightOpen && (
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
        )}
      </div>
    </div>
  );
}
