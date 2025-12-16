import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useAtom } from 'jotai';
import { runTool, getNodeTypes, listDatasets, getDatasetColumns, getDatasetColumnValues, listDestinationTables, executeNodeOperation } from '../../lib/api';
import { sessionAtom } from '../../atoms/sessionAtom';
import type { IngestOperation, FilterOperation, BufferOperation } from '../../lib/engine/operations';
import type { TableRef } from '../../lib/engine/types';

type NodeType = {
  type: string;
  label: string;
  description: string;
  config_schema: any;
  tools: string[];
};

type Props = {
  id: string;
  data: {
    label?: string;
    type?: string;
    tool?: string;
    description?: string;
    config?: Record<string, any>;
    // NEW: Store output table reference from last run
    outputTable?: TableRef;
    rowCount?: number;
  };
};

export default function TaskNode({ id, data }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [editMode, setEditMode] = useState(false);
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [selectedType, setSelectedType] = useState(data.type || 'ingest');
  const [selectedTool, setSelectedTool] = useState(data.tool || 'ingest');
  const [config, setConfig] = useState(data.config || {});
  const [datasets, setDatasets] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [uniqueValues, setUniqueValues] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState(config.dataset || '');
  const [selectedColumn, setSelectedColumn] = useState(config.column || '');
  const [selectedValues, setSelectedValues] = useState<any[]>(config.values || []);
  const [destTables, setDestTables] = useState<string[]>([]);
  const [selectedDest, setSelectedDest] = useState(config.destination || '');
  
  // NEW: Session management and engine mode toggle
  const [sessionId] = useAtom(sessionAtom);
  const [useNewEngine, setUseNewEngine] = useState(true); // Toggle between legacy and new engine
  const [lastResult, setLastResult] = useState<string>(''); // Show result message
  const [outputMode, setOutputMode] = useState<'temporary' | 'persistent'>('temporary'); // Where to store output
  const [selectedInputSource, setSelectedInputSource] = useState<'connected' | 'manual'>('connected'); // Input source selection
  
  // NEW: Access ReactFlow state to get connected nodes
  const reactFlowInstance = useReactFlow();
  
  /**
   * Get input TableRef from connected source node
   * Returns the outputTable from the first connected source node, or undefined
   */
  function getInputFromConnectedNode(): TableRef | undefined {
    const edges = reactFlowInstance.getEdges();
    const nodes = reactFlowInstance.getNodes();
    
    // Find edges where this node is the target
    const incomingEdges = edges.filter(edge => edge.target === id);
    
    if (incomingEdges.length === 0) {
      return undefined;
    }
    
    // Get the first source node's output
    const firstEdge = incomingEdges[0];
    if (!firstEdge) return undefined;
    
    const sourceNodeId = firstEdge.source;
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    
    if (!sourceNode || !sourceNode.data.outputTable) {
      return undefined;
    }
    
    return sourceNode.data.outputTable as TableRef;
  }

  useEffect(() => {
    // Fetch available node types on mount
    getNodeTypes().then(setNodeTypes).catch(console.error);
  // fetch dataset list and dest tables for filter UI
  listDatasets().then((r) => setDatasets(r.datasets || [])).catch(() => setDatasets([]));
  listDestinationTables().then((r) => setDestTables(r.tables || [])).catch(() => setDestTables([]));
  }, []);

  const currentNodeType = nodeTypes.find(nt => nt.type === selectedType);
  const availableTools = currentNodeType?.tools || [];

  /**
   * Run the node using NEW engine API
   * Builds an Operation object and calls executeNodeOperation
   */
  async function runWithNewEngine() {
    if (!sessionId) {
      throw new Error('No active session. Session is required for new engine API.');
    }

    // Determine input table based on selection
    let inputTable: TableRef | undefined;
    
    if (selectedType !== 'ingest') {
      if (selectedInputSource === 'connected') {
        inputTable = getInputFromConnectedNode();
      } else if (selectedInputSource === 'manual' && config.manualInputTable) {
        // Parse manual input (e.g., "temp_abc123" or "my_persistent_table")
        const tableName = config.manualInputTable;
        if (tableName.startsWith('temp_')) {
          inputTable = { kind: 'temporary', name: tableName, sessionId };
        } else {
          inputTable = { kind: 'persistent', name: tableName };
        }
      } else {
        inputTable = data.outputTable; // Fallback to stored output
      }
    }
    
    // Determine destination based on output mode
    let destination = selectedDest;
    if (outputMode === 'temporary') {
      destination = undefined; // Let backend auto-generate temp name
    } else if (outputMode === 'persistent' && !destination) {
      destination = `${selectedType}_${Date.now()}`; // Auto-generate persistent name
    }

    // Build operation based on selectedType
    if (selectedType === 'ingest') {
      // IngestOperation - does not require input
      if (!selectedDataset) {
        throw new Error('Please select a dataset to ingest');
      }
      
      const operation: IngestOperation = {
        type: 'ingest',
        source: { kind: 'dataset', name: selectedDataset },
        filters: selectedColumn && selectedValues.length > 0 
          ? [{ column: selectedColumn, operator: 'in', value: selectedValues }]
          : [],
        destination,
      };
      
      const result = await executeNodeOperation(sessionId, operation);
      
      // Store output table in node data for next node to consume
      if (result.outputTable) {
        data.outputTable = result.outputTable;
        data.rowCount = result.rowCount;
      }
      
      const storageInfo = outputMode === 'temporary' ? '⚡ in-memory' : '💾 persistent';
      setLastResult(result.message || `Ingested ${result.rowCount} rows (${storageInfo})`);
      return;
    }

    if (selectedType === 'filter') {
      // FilterOperation - requires input
      if (!inputTable) {
        throw new Error('Filter requires an input table. Connect a source node or specify manual input.');
      }

      const operation: FilterOperation = {
        type: 'filter',
        input: inputTable,
        filters: selectedColumn && selectedValues.length > 0 
          ? [{ column: selectedColumn, operator: 'in', value: selectedValues }]
          : [],
        destination,
      };

      const result = await executeNodeOperation(sessionId, operation);
      
      if (result.outputTable) {
        data.outputTable = result.outputTable;
        data.rowCount = result.rowCount;
      }
      
      const storageInfo = outputMode === 'temporary' ? '⚡ in-memory' : '💾 persistent';
      setLastResult(result.message || `Filtered to ${result.rowCount} rows (${storageInfo})`);
      return;
    }

    if (selectedType === 'buffer' || selectedTool === 'buffer') {
      // BufferOperation - requires input and distance
      if (!inputTable) {
        throw new Error('Buffer requires an input table. Connect a source node or specify manual input.');
      }

      const distance = Number(config.distance || 100);
      
      const operation: BufferOperation = {
        type: 'buffer',
        input: inputTable,
        distance,
        destination,
      };

      const result = await executeNodeOperation(sessionId, operation);
      
      if (result.outputTable) {
        data.outputTable = result.outputTable;
        data.rowCount = result.rowCount;
      }
      
      const storageInfo = outputMode === 'temporary' ? '⚡ in-memory' : '💾 persistent';
      setLastResult(result.message || `Buffered ${result.rowCount} features (${storageInfo})`);
      return;
    }

    throw new Error(`Operation type '${selectedType}' not yet supported in new engine`);
  }

  /**
   * Run the node using LEGACY API
   * Direct HTTP call to /tools/{tool}
   */
  async function runWithLegacyEngine() {
    // If a destination/table is provided, call the specialized ingest-table tool
    if (config.destination || selectedDest) {
      const payload = {
        dataset: config.dataset || selectedDataset || undefined,
        table: config.destination || selectedDest,
        column: config.column || selectedColumn || undefined,
        values: config.values || selectedValues || undefined,
      };
      await runTool('ingest-table', payload);
    } else {
      await runTool(selectedTool, config);
    }
  }

  async function onRun() {
    setStatus('running');
    setLastResult('');
    
    try {
      if (useNewEngine) {
        await runWithNewEngine();
      } else {
        await runWithLegacyEngine();
      }
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2200);
    } catch (e) {
      console.error('[TaskNode] Run failed:', e);
      setLastResult(e instanceof Error ? e.message : String(e));
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  function onDelete() {
    try {
      const ev = new CustomEvent('node:delete', { detail: { id } });
      window.dispatchEvent(ev);
    } catch (e) {
      (window as any).nodeDelete = id;
    }
  }

  const statusColor =
    status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : status === 'running' ? '#60a5fa' : '#cbd5e1';

  const statusIcon =
    status === 'success' ? '✓' : status === 'error' ? '✕' : status === 'running' ? '↻' : '○';

  const labelText: string = data.label ?? '';

  return (
    <div className="task-node" style={{ width: 280, borderRadius: 12, background: 'white', boxShadow: '0 8px 20px rgba(2,6,23,0.06)', border: '1px solid #eef2f7', overflow: 'hidden', fontFamily: 'Inter, system-ui, Arial' }}>
      {/* Left target handle */}
      <Handle type="target" position={Position.Left} style={{ top: 20, background: '#cbd5e1', width: 10, height: 10, borderRadius: 10 }} />

      {/* Header */}
      <div className="task-node-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 700, border: '1px solid #e2e8f0' }}>
          { (labelText?.charAt(0)?.toUpperCase && labelText.charAt(0).toUpperCase()) || 'T' }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{data.label || 'Task Node'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{currentNodeType?.label || selectedType}</div>
        </div>

        <div title={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, color: statusColor }}>{statusIcon}</span>
        </div>

        <button aria-label="Delete node" title="Delete node" onClick={onDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 12, color: '#475569', fontSize: 13 }}>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Node Type Selector */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Node Type</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  const nt = nodeTypes.find(n => n.type === e.target.value);
                  if (nt && nt.tools.length > 0 && nt.tools[0]) setSelectedTool(nt.tools[0]);
                }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
              >
                {nodeTypes.map(nt => (
                  <option key={nt.type} value={nt.type}>{nt.label}</option>
                ))}
              </select>
            </div>

            {/* Tool Selector */}
            {availableTools.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tool</label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                >
                  {availableTools.map(tool => (
                    <option key={tool} value={tool}>{tool}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Config Fields (simple text inputs for now) */}
            {currentNodeType?.config_schema?.properties && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Configuration</label>
                {Object.entries(currentNodeType.config_schema.properties).map(([key, schema]: [string, any]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>{key}</label>
                    <input
                      type={schema.type === 'number' ? 'number' : 'text'}
                      value={config[key] || schema.default || ''}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      placeholder={schema.description || key}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 11 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Filter-specific UI */}
            {selectedType === 'filter' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Dataset</label>
                <select value={selectedDataset} onChange={async (e) => {
                  const v = e.target.value; setSelectedDataset(v); setSelectedColumn(''); setColumns([]); setUniqueValues([]);
                  setConfig({ ...config, dataset: v });
                  if (v) {
                    const cols = await getDatasetColumns(v).catch(() => ({ columns: [] }));
                    setColumns(cols.columns || []);
                  }
                }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <option value="">-- select dataset --</option>
                  {datasets.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <div style={{ height: 8 }} />

                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Column</label>
                <select value={selectedColumn} onChange={async (e) => {
                  const c = e.target.value; setSelectedColumn(c); setUniqueValues([]);
                  setConfig({ ...config, column: c });
                  if (c && selectedDataset) {
                    const vals = await getDatasetColumnValues(selectedDataset, c).catch(() => ({ values: [] }));
                    setUniqueValues(vals.values || []);
                  }
                }} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <option value="">-- select column --</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>

                <div style={{ height: 8 }} />

                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Values (multi)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: 6, border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  {uniqueValues.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>No values</div>}
                  {uniqueValues.map((v) => {
                    const key = String(v);
                    const checked = selectedValues.map(String).includes(key);
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = selectedValues.map(String);
                            if (e.target.checked) {
                              cur.push(key);
                            } else {
                              const idx = cur.indexOf(key);
                              if (idx >= 0) cur.splice(idx, 1);
                            }
                            const newVals = cur.map((x) => {
                              // try to coerce numeric strings back to numbers when appropriate
                              if (!Number.isNaN(Number(x)) && String(Number(x)) === x) return Number(x);
                              return x;
                            });
                            setSelectedValues(newVals as any[]);
                            setConfig({ ...config, values: newVals });
                          }}
                        />
                        <span>{String(v)}</span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ height: 8 }} />

                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Destination Table</label>
                {/* Free-text input for destination table name with suggestions via datalist */}
                <input
                  list={`dest-table-suggestions-${id}`}
                  value={selectedDest}
                  onChange={(e) => { setSelectedDest(e.target.value); setConfig({ ...config, destination: e.target.value }); }}
                  placeholder="enter destination table name"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <datalist id={`dest-table-suggestions-${id}`}>
                  {destTables.map(t => <option key={t} value={t}>{t}</option>)}
                </datalist>
              </div>
            )}

            {/* Input Source Selection (for filter/buffer nodes) */}
            {useNewEngine && (selectedType === 'filter' || selectedType === 'buffer') && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Input Source</label>
                <select 
                  value={selectedInputSource} 
                  onChange={(e) => setSelectedInputSource(e.target.value as 'connected' | 'manual')}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                >
                  <option value="connected">From Connected Node</option>
                  <option value="manual">Manual Table Reference</option>
                </select>
                
                {selectedInputSource === 'connected' && (
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, padding: '4px 6px', background: '#f8fafc', borderRadius: 4 }}>
                    {(() => {
                      const inputTable = getInputFromConnectedNode();
                      if (!inputTable) return '⚠️ No node connected (connect an edge first)';
                      
                      if (inputTable.kind === 'file') {
                        return `📊 Using file: ${inputTable.path}`;
                      } else {
                        return `📊 Using ${inputTable.kind}: ${inputTable.name}`;
                      }
                    })()}
                  </div>
                )}
                
                {selectedInputSource === 'manual' && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 4 }}>Table Name</label>
                    <input
                      type="text"
                      value={config.manualInputTable || ''}
                      onChange={(e) => setConfig({ ...config, manualInputTable: e.target.value })}
                      placeholder="temp_abc123 or persistent_table"
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 11 }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Output Storage Mode */}
            {useNewEngine && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Output Storage</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <label style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: `2px solid ${outputMode === 'temporary' ? '#3b82f6' : '#e2e8f0'}`, background: outputMode === 'temporary' ? '#eff6ff' : '#fff' }}>
                    <input 
                      type="radio" 
                      checked={outputMode === 'temporary'} 
                      onChange={() => setOutputMode('temporary')}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>⚡ In-Memory</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>Fast, temp tables</div>
                    </div>
                  </label>
                  
                  <label style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: `2px solid ${outputMode === 'persistent' ? '#3b82f6' : '#e2e8f0'}`, background: outputMode === 'persistent' ? '#eff6ff' : '#fff' }}>
                    <input 
                      type="radio" 
                      checked={outputMode === 'persistent'} 
                      onChange={() => setOutputMode('persistent')}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>💾 Persistent</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>Save to database</div>
                    </div>
                  </label>
                </div>
                
                {outputMode === 'persistent' && (
                  <div style={{ fontSize: 10, color: '#64748b', padding: '4px 6px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: 4 }}>
                    💡 Will save to "{selectedDest || 'auto_generated_name'}"
                  </div>
                )}
              </div>
            )}

            {/* Engine Mode Toggle */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useNewEngine}
                  onChange={(e) => setUseNewEngine(e.target.checked)}
                />
                <span>Use New Engine API</span>
              </label>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                {useNewEngine ? '✨ Session-based with temp tables' : '⚙️ Legacy direct API'}
              </div>
            </div>

            <button onClick={() => setEditMode(false)} style={{ padding: '6px 10px', background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ minHeight: 36, marginBottom: 10 }}>{data.description || currentNodeType?.description || 'No description.'}</div>

            {/* Show last result/output info */}
            {lastResult && (
              <div style={{ padding: '6px 8px', background: status === 'error' ? '#fee2e2' : '#f0fdf4', border: `1px solid ${status === 'error' ? '#fecaca' : '#bbf7d0'}`, borderRadius: 6, marginBottom: 10, fontSize: 11, color: status === 'error' ? '#b91c1c' : '#15803d' }}>
                {lastResult}
              </div>
            )}

            {/* Show output table info if available */}
            {data.outputTable && data.rowCount !== undefined && (
              <div style={{ padding: '6px 8px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 6, marginBottom: 10, fontSize: 10, color: '#1e40af' }}>
                📊 Output: {data.outputTable.kind === 'temporary' ? 'temp' : data.outputTable.kind} table "{data.outputTable.kind === 'file' ? data.outputTable.path : data.outputTable.name}" ({data.rowCount} rows)
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ background: '#f1f5f9', color: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  {selectedTool}
                </div>
                <button
                  onClick={() => setEditMode(true)}
                  title="Configure node"
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#64748b' }}
                >
                  ⚙
                </button>
              </div>

              <button
                onClick={onRun}
                disabled={status === 'running'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  background: status === 'running' ? '#93c5fd' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: status === 'running' ? 'progress' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {status === 'running' ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.24" strokeWidth="2" />
                      <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Running
                  </>
                ) : (
                  <>▶ Run</>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right source handle */}
      <Handle type="source" position={Position.Right} style={{ top: 20, background: '#2563eb', width: 10, height: 10, borderRadius: 10 }} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
