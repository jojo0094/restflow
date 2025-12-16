import React, { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TopBar from './components/TopBar/TopBar';
import FileBrowserDialog from './components/FileBrowser/FileBrowserDialog';
import { initEngine } from './lib/api';

const initialNodes = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
        { id: '2', position: { x: 0, y: 100 }, data: { label: 'World' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export default function App() {
        const [filesOpen, setFilesOpen] = useState(false);
        const [engineReady, setEngineReady] = useState(false);

        // Initialize the data engine on mount
        // This connects to the backend or loads WASM (depending on mode)
        useEffect(() => {
                initEngine('remote')
                        .then(() => {
                                console.log('[App] Engine initialized successfully');
                                setEngineReady(true);
                        })
                        .catch((error) => {
                                console.error('[App] Failed to initialize engine:', error);
                                // Could show an error UI here
                        });
        }, []);

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
