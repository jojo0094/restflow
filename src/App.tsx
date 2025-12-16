import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TopBar from './components/TopBar/TopBar';
import FileBrowserDialog from './components/FileBrowser/FileBrowserDialog';
import { initEngine } from './lib/api';
import { engineReadyAtom } from './atoms/engineAtom';
import Layout from './components/Layout';

const initialNodes = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
        { id: '2', position: { x: 0, y: 100 }, data: { label: 'World' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export default function App() {
        console.log('[App] Component is mounting...');

        const [filesOpen, setFilesOpen] = useState(false);
        const [engineReady, setEngineReady] = useAtom(engineReadyAtom);
        const [engineError, setEngineError] = useState<string | null>(null);

        // Initialize the data engine on mount
        // This connects to the backend or loads WASM (depending on mode)
        useEffect(() => {
                console.log('[App] useEffect triggered for engine initialization');
                console.log('[App] Checking if initEngine is called...');

                initEngine('remote')
                        .then(() => {
                                console.log('[App] ✓ Engine initialized successfully');
                                // engineReady is set by initEngine via Jotai store
                        })
                        .catch((error) => {
                                console.error('[App] ✗ Failed to initialize engine:', error);
                                setEngineError(error.message || 'Failed to connect to backend');
                        });
        }, []);

        // Debug log for engineReadyAtom state
        console.log('[App] Component rendered, engineReady state:', engineReady);

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
                                        <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{engineError}</div>
                                        <div style={{ fontSize: 12, color: '#7f1d1d', background: '#fee2e2', padding: 12, borderRadius: 6 }}>
                                                <strong>Make sure the backend is running:</strong><br/>
                                                <code style={{ fontSize: 11, background: '#fff', padding: '4px 6px', borderRadius: 4, display: 'inline-block', marginTop: 6 }}>
                                                        cd backend && uv run uvicorn app.main:app --reload --port 8000
                                                </code>
                                        </div>
                                </div>
                        </div>
                );
        }

        function handleSelect(files: FileList | null) {
                // placeholder: future processing
                console.log('selected', files);
        }

        return (
                <div className="h-screen w-screen flex flex-col bg-slate-50">
                        <TopBar onOpenFiles={() => setFilesOpen(true)} />

                        <main className="flex-1">
                                <div style={{ width: '100%', height: '100%' }}>
                                        {!engineReady && (
                                                <div style={{ 
                                                        position: 'absolute', 
                                                        top: '50%', 
                                                        left: '50%', 
                                                        transform: 'translate(-50%, -50%)',
                                                        textAlign: 'center',
                                                        color: '#64748b'
                                                }}>
                                                        Connecting to backend...
                                                </div>
                                        )}
                                        <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
                                                <Background />
                                                <Controls />
                                        </ReactFlow>
                                </div>
                        </main>

                        <FileBrowserDialog
                                open={filesOpen}
                                onClose={() => setFilesOpen(false)}
                                onSelect={handleSelect}
                        />
                </div>
        );
}
