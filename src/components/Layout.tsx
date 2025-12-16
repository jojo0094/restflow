import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import MapPanel from "./MapPanel";
import TopBar from "./TopBar/TopBar";
import FileBrowserDialog from "./FileBrowser/FileBrowserDialog";
import WorkflowPanel from "./WorkflowPanel";
import { initEngine } from "../lib/api";
import { engineReadyAtom } from "../atoms/engineAtom";

export default function Layout() {
  console.log('[Layout] Component rendering...');

  const [topBarHeight, setTopBarHeight] = useState(180);
  const [bottomBarHeight, setBottomBarHeight] = useState(180);
  const [draggingHandle, setDraggingHandle] = useState<"top" | "bottom" | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engine initialization state
  const [engineReady, setEngineReady] = useAtom(engineReadyAtom);
  const [engineError, setEngineError] = useState<string | null>(null);

  // Initialize the data engine on mount
  useEffect(() => {
    console.log('[Layout] Engine initialization useEffect triggered');
    
    initEngine('remote')
      .then(() => {
        console.log('[Layout] ✓ Engine initialized successfully');
      })
      .catch((error) => {
        console.error('[Layout] ✗ Failed to initialize engine:', error);
        setEngineError(error.message || 'Failed to connect to backend');
      });
  }, []);

  // Handle drag resizing
  useEffect(() => {
    console.log('[Layout] Setting up drag handlers...');

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
      console.log('[Layout] Cleaning up drag handlers...');
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingHandle, topBarHeight]);

  console.log('[Layout] engineReady:', engineReady, 'engineError:', engineError);

  // Show loading state while engine initializes
  if (!engineReady && !engineError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>🔄 Connecting to backend...</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Initializing data engine</div>
        </div>
      </div>
    );
  }

  // Show error state if engine failed to initialize
  if (engineError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 500, padding: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#b91c1c', marginBottom: 12 }}>❌ Failed to connect to backend</div>
          <div style={{ fontSize: 14, color: '#991b1b', marginBottom: 16 }}>{engineError}</div>
          <div style={{ fontSize: 12, color: '#7f1d1d' }}>
            Make sure the backend is running:
            <pre style={{ background: '#fee2e2', padding: 8, borderRadius: 4, marginTop: 8 }}>
              cd backend && uv run uvicorn app.main:app --reload --port 8000
            </pre>
          </div>
        </div>
      </div>
    );
  }

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