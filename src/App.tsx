import React, { useState } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TopBar from './components/TopBar/TopBar';
import FileBrowserDialog from './components/FileBrowser/FileBrowserDialog';

const initialNodes = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
        { id: '2', position: { x: 0, y: 100 }, data: { label: 'World' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export default function App() {
        const [filesOpen, setFilesOpen] = useState(false);

        function handleSelect(files: FileList | null) {
                // placeholder: future processing
                console.log('selected', files);
        }

        return (
                <div className="h-screen w-screen flex flex-col bg-slate-50">
                        <TopBar onOpenFiles={() => setFilesOpen(true)} />

                        <main className="flex-1">
                                <div style={{ width: '100%', height: '100%' }}>
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
