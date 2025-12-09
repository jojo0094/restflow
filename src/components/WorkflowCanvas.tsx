import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
        { id: '2', position: { x: 0, y: 100 }, data: { label: 'World' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

interface Props {
        collapsed?: boolean;
}

export default function WorkflowCanvas({ collapsed = false }: Props) {
        // When collapsed we can render a light preview or nothing
        if (collapsed) {
                return (
                        <div style={{ padding: 12 }}>
                                <div style={{ color: '#6b7280' }}>Workflow (collapsed)</div>
                        </div>
                );
        }

        return (
                <div style={{ width: '100%', height: '480px' }}>
                        <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
                                <Background />
                                <Controls />
                        </ReactFlow>
                </div>
        );
}
