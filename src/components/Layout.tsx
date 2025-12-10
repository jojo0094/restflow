import { useEffect, useRef, useState } from "react";
import MapPanel from "./MapPanel";
import TopBar from "./TopBar/TopBar";
import FileBrowserDialog from "./FileBrowser/FileBrowserDialog";
import WorkflowPanel from "./WorkflowPanel";

export default function Layout() {
  const [topBarHeight, setTopBarHeight] = useState(180);
  const [bottomBarHeight, setBottomBarHeight] = useState(180);
  const [draggingHandle, setDraggingHandle] = useState<"top" | "bottom" | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingHandle || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (draggingHandle === "bottom") {
        const raw = rect.bottom - e.clientY;
        const minBottom = 80;
        const minMiddle = 120;
        const maxBottom = Math.max(
          minBottom,
          rect.height - topBarHeight - minMiddle
        );
        const newHeight = Math.max(minBottom, Math.min(raw, maxBottom));
        setBottomBarHeight(newHeight);
      } else {
        const newHeight = Math.max(80, e.clientY - rect.top);
        setTopBarHeight(newHeight);
      }
    }

    function onUp() {
      setDraggingHandle(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingHandle, topBarHeight]);

  return (
    <>
      <div
        className="app-root"
        ref={containerRef}
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ height: topBarHeight, maxHeight: "80px" }}>
          <TopBar onOpenFiles={() => setShowSideMenu(true)} />
        </div>

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
            </div>
          </div>
        </div>
      </div>
      
      {/* Dialog is rendered OUTSIDE app-root as a sibling */}
      <FileBrowserDialog
        open={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        onSelect={(files) => {
          console.log('selected', files);
          setShowSideMenu(false);
        }}
      />
    </>
  );
}