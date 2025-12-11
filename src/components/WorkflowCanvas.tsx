import React from 'react';
import { ReactFlow, Background, Controls, useNodesState, applyNodeChanges } from '@xyflow/react';
import type { Node, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TaskNode from './WorkflowPanel/TaskNode';

const initialNodes: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' }, type: 'default' },
        { id: 'task-1', position: { x: 200, y: 80 }, data: { label: 'Ingest Data', tool: 'ingest' }, type: 'task' },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: 'task-1' }];

interface Props {
        collapsed?: boolean;
        nodes?: Node[];
        setNodes?: React.Dispatch<React.SetStateAction<Node[]>>;
}

const nodeTypes = {
        task: TaskNode,
};

export default function WorkflowCanvas({ collapsed = false, nodes: controlledNodes, setNodes: setControlledNodes }: Props) {
        const [internalNodes, , setInternalNodes] = useNodesState(initialNodes);
        const nodes = controlledNodes ?? internalNodes;
        const setNodes = setControlledNodes ?? setInternalNodes;

        if (collapsed) {
                return (
                        <div style={{ padding: 12 }}>
                                <div style={{ color: '#6b7280' }}>Workflow (collapsed)</div>
                        </div>
                );
        }

                        function onNodesChange(changes: NodeChange[]) {
                                if (setControlledNodes) {
                                        setControlledNodes((prev) => applyNodeChanges(changes, prev));
                                } else {
                                        // use the internal setter overload which accepts NodeChange[]
                                        // cast to any to satisfy TypeScript overload resolution
                                        (setInternalNodes as any)(changes);
                                }
                        }

                return (
                        <div style={{ width: '100%', height: '480px' }}>
                                <ReactFlow nodes={nodes} edges={initialEdges} fitView nodeTypes={nodeTypes} onNodesChange={onNodesChange}>
                                        <Background />
                                        <Controls />
                                </ReactFlow>
                        </div>
                );
}
