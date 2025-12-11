import React from 'react';
import { ReactFlow, Background, Controls, useNodesState, applyNodeChanges, useEdgesState, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Node, NodeChange, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TaskNode from './WorkflowPanel/TaskNode';

const initialNodes: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Hello' }, type: 'default' },
        { id: 'task-1', position: { x: 200, y: 80 }, data: { label: 'Ingest Data', tool: 'ingest' }, type: 'task' },
];

const initialEdges: Edge[] = [{ id: 'e1-2', source: '1', target: 'task-1' }];

interface Props {
        collapsed?: boolean;
        nodes?: Node[];
        setNodes?: React.Dispatch<React.SetStateAction<Node[]>>;
}

const nodeTypes = {
        task: TaskNode,
};

export default function WorkflowCanvas({ collapsed = false, nodes: controlledNodes, setNodes: setControlledNodes }: Props) {
        // useNodesState/useEdgesState return [state, setState, onChange]
        const [internalNodes, setInternalNodes /* setter */, internalOnNodesChange] = useNodesState(initialNodes);
        const nodes = controlledNodes ?? internalNodes;
        const setNodes = setControlledNodes ?? setInternalNodes;

        const [internalEdges, setInternalEdges /* setter */, internalOnEdgesChange] = useEdgesState(initialEdges);
        const edges = internalEdges;

        React.useEffect(() => {
                function handleDelete(e: any) {
                        const nodeId = e?.detail?.id ?? (window as any).nodeDelete;
                        if (!nodeId) return;

                        // remove node
                        if (setControlledNodes) {
                                setControlledNodes((prev) => prev.filter((n) => n.id !== nodeId));
                        } else {
                                // use internal setter overload via cast
                                (setInternalNodes as any)((changes: any) => changes.filter((n: Node) => n.id !== nodeId));
                        }

                        // remove edges referencing the node
                        (setInternalEdges as any)((eds: Edge[]) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
                }

                window.addEventListener('node:delete', handleDelete as EventListener);
                return () => window.removeEventListener('node:delete', handleDelete as EventListener);
        }, [setControlledNodes, setInternalNodes, setInternalEdges]);

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
                                        setInternalNodes((prev) => applyNodeChanges(changes, prev));
                                }
                        }

                        function onEdgesChange(changes: any) {
                                // apply edge changes to current edges
                                setInternalEdges((prev) => applyEdgeChanges(changes, prev));
                        }

                        function onConnect(connection: Connection) {
                                const e = addEdge(connection, edges);
                                setInternalEdges((prev) => [...prev, ...(Array.isArray(e) ? e : [e])]);
                        }

                return (
                        <div style={{ width: '100%', height: '480px' }}>
                                <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}>
                                        <Background />
                                        <Controls />
                                </ReactFlow>
                        </div>
                );
}
