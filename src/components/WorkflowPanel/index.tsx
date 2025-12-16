import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import WorkflowCanvas from "../WorkflowCanvas";
import { runWorkflow, createWorkflowSession, destroyWorkflowSession, commitWorkflowTable } from "../../lib/api";
import { sessionAtom } from "../../atoms/sessionAtom";
import { engineReadyAtom } from "../../atoms/engineAtom";
import type { Node } from '@xyflow/react';

export default function WorkflowPanel() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(leftOpen ? 220 : 40);
  const [rightWidth, setRightWidth] = useState(rightOpen ? 220 : 40);
  const resizingRef = useRef(false);
  const sideRef = useRef("left");

  // Session management - create session on mount, cleanup on unmount
  const [sessionId, setSessionId] = useAtom(sessionAtom);
  const [engineReady] = useAtom(engineReadyAtom);
  const [sessionStatus, setSessionStatus] = useState<'creating' | 'ready' | 'error'>('creating');
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    // CRITICAL: Wait for engine to be ready before creating session
    console.log('[WorkflowPanel] engineReady state:', engineReady);
    if (!engineReady) {
      console.log('[WorkflowPanel] Waiting for engine to initialize...');
      return;
    }
    
    let mounted = true;
    let currentSessionId: string | null = null;

    // Create workflow session (engine is NOW ready)
    console.log('[WorkflowPanel] Creating workflow session...');
    
    createWorkflowSession()
      .then((newSessionId) => {
        if (!mounted) return;
        console.log('[WorkflowPanel] ✓ Session created:', newSessionId);
        currentSessionId = newSessionId;
        setSessionId(newSessionId);
        setSessionStatus('ready');
        setSessionError(null);
      })
      .catch((error) => {
        console.error('[WorkflowPanel] ✗ Failed to create session:', error);
        setSessionStatus('error');
        setSessionError(error.message || 'Unknown error');
      });

    return () => {
      mounted = false;
      if (currentSessionId) {
        console.log('[WorkflowPanel] Destroying session:', currentSessionId);
        destroyWorkflowSession(currentSessionId).catch(console.error);
      }
    };
  }, [engineReady]); // Re-run when engine becomes ready

  // nodes state for the canvas (moved here so panel can add nodes)
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' }, type: 'default' } as Node,
  ]);

  function addIngestNode() {
    const id = `ingest-${Date.now()}`;
    const node: Node = {
      id,
      type: 'task',
      position: { x: 200 + Math.floor(Math.random() * 200), y: 80 + Math.floor(Math.random() * 160) },
      data: { label: 'Ingest Data', type: 'ingest', tool: 'ingest', description: 'Ingests sample datasets' },
      draggable: true,
    };
    setNodes((s) => [...s, node]);
  }

  function addFilterNode() {
    const id = `filter-${Date.now()}`;
    const node: Node = {
      id,
      type: 'task',
      position: { x: 250 + Math.floor(Math.random() * 200), y: 120 + Math.floor(Math.random() * 160) },
      data: { label: 'Filter Data', type: 'filter', tool: 'filter', description: 'Filters rows based on column values' },
      draggable: true,
    };
    setNodes((s) => [...s, node]);
  }

  function addBufferNode() {
    const id = `buffer-${Date.now()}`;
    const node: Node = {
      id,
      type: 'task',
      position: { x: 300 + Math.floor(Math.random() * 200), y: 160 + Math.floor(Math.random() * 160) },
      data: { label: 'Buffer Geometry', type: 'buffer', tool: 'buffer', description: 'Creates buffer zones around geometries', config: { distance: 100 } },
      draggable: true,
    };
    setNodes((s) => [...s, node]);
  }

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
        {/* Toolbar above the canvas */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 8, zIndex: 40 }}>
          <div style={{ background: 'white', padding: 6, borderRadius: 8, boxShadow: '0 6px 18px rgba(2,6,23,0.08)', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Session Status Indicator */}
            <div style={{ 
              padding: '4px 8px', 
              borderRadius: 6, 
              fontSize: 11, 
              fontWeight: 600,
              background: sessionId ? '#dcfce7' : sessionError ? '#fee2e2' : '#fef3c7',
              color: sessionId ? '#166534' : sessionError ? '#991b1b' : '#92400e',
              border: `1px solid ${sessionId ? '#bbf7d0' : sessionError ? '#fecaca' : '#fde68a'}`
            }}>
              {sessionId ? `✓ Session: ${sessionId.substring(0, 8)}...` : sessionError ? '✗ No Session' : '⟳ Starting...'}
            </div>
            
            <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
            
            <button onClick={addIngestNode} style={{ padding: '6px 10px', borderRadius: 6, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              + Ingest
            </button>
            
            <button onClick={addFilterNode} style={{ padding: '6px 10px', borderRadius: 6, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              + Filter
            </button>
            
            <button onClick={addBufferNode} style={{ padding: '6px 10px', borderRadius: 6, background: '#db2777', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              + Buffer
            </button>
          </div>
        </div>
      <div
        className="workflow-canvas"
        style={{ flex: 1, width: "100%", height: "100%", background: "white" }}
      >
        <WorkflowCanvas nodes={nodes} setNodes={setNodes} />
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
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                style={{ padding: '8px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ▶ Run Workflow
              </button>

              {/* Commit Results Button - NEW */}
              <button
                onClick={async () => {
                  if (!sessionId) {
                    alert('No active session. Please run a node first.');
                    return;
                  }

                  // Simple prompt for table name (can be enhanced with modal later)
                  const tableName = prompt('Enter the final table name to commit results:');
                  if (!tableName) return;

                  // For now, we need to know which temp table to commit
                  // In a real implementation, you'd select a node's output table
                  // For demo purposes, let's ask for temp table name too
                  const tempTableName = prompt('Enter the temporary table name (from node output):');
                  if (!tempTableName) return;

                  try {
                    await commitWorkflowTable(sessionId, tempTableName, tableName);
                    alert(`✓ Successfully committed temporary table "${tempTableName}" to "${tableName}"`);
                  } catch (err) {
                    alert(`Failed to commit: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
                disabled={!sessionId}
                style={{ 
                  padding: '8px 12px', 
                  background: sessionId ? '#ea580c' : '#d1d5db', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: sessionId ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: 13
                }}
                title={sessionId ? 'Commit temporary results to permanent storage' : 'No active session'}
              >
                💾 Commit Results
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
