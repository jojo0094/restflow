import { useEffect, useRef, useState } from "react";
import MapPanel from "./MapPanel";
import SideMenu from "./SideMenu";
import WorkflowCanvas from "./WorkflowCanvas";
import WorkflowPanel from "./WorkflowPanel";

export default function Layout() {
  // height of the top and bottom bars in px
  const [topBarHeight, setTopBarHeight] = useState(180);
  const [bottomBarHeight, setBottomBarHeight] = useState(180);
  // 'top' when dragging the top divider, 'bottom' when dragging the bottom divider
  const [draggingHandle, setDraggingHandle] = useState<"top" | "bottom" | null>(
    null
  );
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingHandle || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (draggingHandle === "bottom") {
        // measure from bottom up and clamp so middle area remains usable
        const raw = rect.bottom - e.clientY;
        const minBottom = 80;
        const minMiddle = 120; // don't let middle collapse
        const maxBottom = Math.max(
          minBottom,
          rect.height - topBarHeight - minMiddle
        );
        const newHeight = Math.max(minBottom, Math.min(raw, maxBottom));
        setBottomBarHeight(newHeight);
      } else {
        // dragging top divider: measure from top down
        const newHeight = Math.max(80, e.clientY - rect.top);
        setTopBarHeight(newHeight);
      }
    }

    function onUp() {
      setDraggingHandle(null);
    }

    // use pointer events for wider support
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingHandle]);

  return (
    <div
      className="app-root"
      ref={containerRef}
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Top bar */}
      <div
        className="top-bar"
        style={{
          height: topBarHeight,
          maxHeight: "20px",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <div
          className="bar-left"
          style={{
            width: 64,
            background: "#111827",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            className="p-2"
            onClick={() => setShowSideMenu(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>

        <div className="bar-center" style={{ flex: 1, padding: 12 }}>
          <div
            style={{
              background: "white",
              borderRadius: 8,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#374151",
            }}
          >
            Map / Flow area
          </div>
        </div>
      </div>

      {/* Top divider handle (drag to resize top bar) */}
      <div
        className="bar-handle top-handle"
        onPointerDown={() => setDraggingHandle("top")}
        style={{ height: 8, cursor: "row-resize", background: "#e5e7eb" }}
        aria-hidden
      />
      <div
        className="MapPlusWorkflowArea"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Main top area: map placeholder */}
        <div
          className="Poppable-1"
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            paddingBottom: bottomBarHeight,
          }}
        >
          <MapPanel />

          {/* Side menu popup overlay */}
          {showSideMenu && (
            <div
              className="side-popup-overlay"
              onClick={() => setShowSideMenu(false)}
            >
              <div className="side-popup" onClick={(e) => e.stopPropagation()}>
                <SideMenu
                  toggleWorkflow={() => setShowWorkflow((s) => !s)}
                  close={() => setShowSideMenu(false)}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className="Poppable-2"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: bottomBarHeight,
            overflow: "hidden",
          }}
        >
          {/* Divider / drag handle for bottom bar (drag to resize bottom bar) - positioned so it moves with the bar */}
          <div
            className="bar-handle bottom-handle"
            onPointerDown={() => setDraggingHandle("bottom")}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 8,
              cursor: "row-resize",
              background: "#e5e7eb",
              top: 0,
            }}
            aria-hidden
          />
          {/* Bottom bar fills this container */}
          <div
            className="bottom-bar"
            style={{
              height: "100%",
              display: "flex",
              alignItems: "stretch",
              paddingTop: 8,
            }}
          >
            <WorkflowPanel />
            {/* <div */}
            {/*   className="bar-left" */}
            {/*   style={{ */}
            {/*     width: 64, */}
            {/*     background: "#111827", */}
            {/*     color: "white", */}
            {/*     display: "flex", */}
            {/*     alignItems: "center", */}
            {/*     justifyContent: "center", */}
            {/*   }} */}
            {/* > */}
            {/*   <button */}
            {/*     className="p-2" */}
            {/*     onClick={() => setShowSideMenu(true)} */}
            {/*     aria-label="Open menu" */}
            {/*   > */}
            {/*     ☰ */}
            {/*   </button> */}
            {/* </div> */}

            {/* <div */}
            {/*   className="bar-right" */}
            {/*   style={{ */}
            {/*     width: 320, */}
            {/*     background: "#f9fafb", */}
            {/*     borderLeft: "1px solid #e5e7eb", */}
            {/*     position: "relative", */}
            {/*   }} */}
            {/* > */}
            {/* Workflow slidable panel */}
            {/* <div */}
            {/*   style={{ */}
            {/*     position: "absolute", */}
            {/*     left: showWorkflow ? 0 : "100%", */}
            {/*     top: 0, */}
            {/*     width: 920, */}
            {/*     height: "100%", */}
            {/*     transition: "left 240ms ease-in-out", */}
            {/*     boxShadow: "-4px 0 12px rgba(0,0,0,0.08)", */}
            {/*     background: "white", */}
            {/*   }} */}
            {/* > */}
            {/*   <div style={{ position: "absolute", left: -28, top: 12 }}> */}
            {/*     <button */}
            {/*       aria-label="Toggle workflow" */}
            {/*       onClick={() => setShowWorkflow((s) => !s)} */}
            {/*       style={{ */}
            {/*         width: 28, */}
            {/*         height: 56, */}
            {/*         borderRadius: 4, */}
            {/*         background: "#111827", */}
            {/*         color: "white", */}
            {/*         border: "none", */}
            {/*       }} */}
            {/*     > */}
            {/*       {showWorkflow ? "›" : "‹"} */}
            {/*     </button> */}
            {/*   </div> */}
            {/**/}
            {/*   <div style={{ height: "100%", overflow: "auto" }}> */}
            {/*     <WorkflowCanvas collapsed={!showWorkflow} /> */}
            {/*   </div> */}
            {/* </div> */}
            {/* </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
