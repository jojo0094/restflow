import React from 'react';
import { ReactFlow, Background, Controls, useNodesState } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TaskNode from './WorkflowPanel/TaskNode';

const initialNodes: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' }, type: 'default' },
        { id: 'task-1', position: { x: 200, y: 80 }, data: { label: 'Ingest Data', tool: 'ingest' }, type: 'task' },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: 'task-1' }];

interface Props {
        collapsed?: boolean;
}

const nodeTypes = {
        task: TaskNode,
};

export default function WorkflowCanvas({ collapsed = false }: Props) {
        const [nodes, , setNodes] = useNodesState(initialNodes);

        if (collapsed) {
                return (
                        <div style={{ padding: 12 }}>
                                <div style={{ color: '#6b7280' }}>Workflow (collapsed)</div>
                        </div>
                );
        }

        return (
                <div style={{ width: '100%', height: '480px' }}>
                        <ReactFlow nodes={nodes} edges={initialEdges} fitView nodeTypes={nodeTypes}>
                                <Background />
                                <Controls />
                        </ReactFlow>
                </div>
        );
}
