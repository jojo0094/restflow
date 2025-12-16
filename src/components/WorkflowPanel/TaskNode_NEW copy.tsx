import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, NodeResizer } from '@xyflow/react';
import { useAtom } from 'jotai';
import { getNodeTypes, listDatasets, executeNodeOperation, getDatasetColumns, getDatasetColumnValues } from '../../lib/api';
import { sessionAtom } from '../../atoms/sessionAtom';
import type { IngestOperation, FilterOperation, BufferOperation } from '../../lib/engine/operations';
import type { TableRef } from '../../lib/engine/types';

type Props = {
  id: string;
  data: {
    label?: string;
    type?: string;
    outputTable?: TableRef;
    rowCount?: number;
  };
  selected?: boolean;
};

export default function TaskNode({ id, data, selected }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [editMode, setEditMode] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [sessionId] = useAtom(sessionAtom);
  const reactFlowInstance = useReactFlow();

  // Node configuration
  const [nodeType, setNodeType] = useState(data.type || 'ingest');
  const [outputMode, setOutputMode] = useState<'temporary' | 'persistent'>('temporary');
  const [outputName, setOutputName] = useState<string>('');

  // Input source configuration
  const [inputSource, setInputSource] = useState<'file' | 'sqlite' | 'connected'>('file');
  const [sqliteTables, setSqliteTables] = useState<string[]>([]);
  const [selectedSqliteTable, setSelectedSqliteTable] = useState<string>('');
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');

  // Filter configuration
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [columnValues, setColumnValues] = useState<any[]>([]);
  const [selectedValues, setSelectedValues] = useState<any[]>([]);

  // Buffer configuration
  const [bufferDistance, setBufferDistance] = useState<number>(100);

  useEffect(() => {
    // Load datasets for ingest operations
    listDatasets().then((r) => setDatasets(r.datasets || [])).catch(console.error);
    
    // TODO: Load SQLite tables from hardcoded database
    // For now, using mock data
    setSqliteTables(['water_points_fixed', 'water_lines_fixed']);
  }, []);

  // Load columns when dataset/table selected
  useEffect(() => {
    if (nodeType === 'ingest' && selectedDataset) {
      getDatasetColumns(selectedDataset)
        .then(cols => setColumns(cols))
        .catch(console.error);
    }
  }, [selectedDataset, nodeType]);

  // Load column values when column selected
  useEffect(() => {
    if (selectedColumn && selectedDataset) {
      getDatasetColumnValues(selectedDataset, selectedColumn)
        .then(vals => setColumnValues(vals))
        .catch(console.error);
    }
  }, [selectedColumn, selectedDataset]);

  /**
   * Get input TableRef from connected source node
   */
  function getConnectedInput(): TableRef | undefined {
    const edges = reactFlowInstance.getEdges();
    const nodes = reactFlowInstance.getNodes();
    
    const incomingEdges = edges.filter(edge => edge.target === id);
    if (incomingEdges.length === 0) return undefined;
    
    const firstEdge = incomingEdges[0];
    if (!firstEdge) return undefined;
    
    const sourceNode = nodes.find(n => n.id === firstEdge.source);
    if (!sourceNode || !sourceNode.data.outputTable) return undefined;
    
    return sourceNode.data.outputTable as TableRef;
  }

  /**
   * Execute the node operation
   */
  async function runNode() {
    if (!sessionId) {
      throw new Error('No active session');
    }

    setStatus('running');
    setLastResult('');

    try {
      let result: any;

      if (nodeType === 'ingest') {
        // Build input source
        let source: { kind: 'dataset'; name: string } | { kind: 'file'; path: string };
        
        if (inputSource === 'file') {
          // TODO: File browser integration
          source = { kind: 'file', path: 'C:\\Users\\jkyawkyaw\\.spatialite_databases\\3waters_wk.sqlite' };
        } else if (inputSource === 'sqlite' && selectedSqliteTable) {
          source = { kind: 'dataset', name: selectedSqliteTable };
        } else if (selectedDataset) {
          source = { kind: 'dataset', name: selectedDataset };
        } else {
          throw new Error('Please select an input source');
        }

        const operation: IngestOperation = {
          type: 'ingest',
          source,
          filters: selectedColumn && selectedValues.length > 0 
            ? [{ column: selectedColumn, operator: 'in', value: selectedValues }]
            : [],
          destination: outputMode === 'persistent' ? outputName || undefined : undefined,
        };

        result = await executeNodeOperation(sessionId, operation);
      } 
      else if (nodeType === 'filter') {
        const input = getConnectedInput();
        if (!input) {
          throw new Error('Filter requires a connected input node');
        }

        const operation: FilterOperation = {
          type: 'filter',
          input,
          filters: selectedColumn && selectedValues.length > 0 
            ? [{ column: selectedColumn, operator: 'in', value: selectedValues }]
            : [],
          destination: outputMode === 'persistent' ? outputName || undefined : undefined,
        };

        result = await executeNodeOperation(sessionId, operation);
      } 
      else if (nodeType === 'buffer') {
        const input = getConnectedInput();
        if (!input) {
          throw new Error('Buffer requires a connected input node');
        }

        const operation: BufferOperation = {
          type: 'buffer',
          input,
          distance: bufferDistance,
          destination: outputMode === 'persistent' ? outputName || undefined : undefined,
        };

        result = await executeNodeOperation(sessionId, operation);
      } 
      else {
        throw new Error(`Unknown operation type: ${nodeType}`);
      }

      // Store result in node data
      if (result.outputTable) {
        data.outputTable = result.outputTable;
        data.rowCount = result.rowCount;
      }

      const storageInfo = outputMode === 'temporary' ? '⚡ temp' : '💾 persistent';
      setLastResult(`✓ ${result.rowCount} rows (${storageInfo})`);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error: any) {
      console.error('[TaskNode] Run failed:', error);
      setLastResult(`✗ ${error.message}`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  // Colors based on status
  const borderColor = 
    status === 'running' ? '#3b82f6' :
    status === 'success' ? '#22c55e' :
    status === 'error' ? '#ef4444' :
    selected ? '#3b82f6' : '#e2e8f0';

  const bgColor = 
    status === 'running' ? '#eff6ff' :
    status === 'success' ? '#f0fdf4' :
    status === 'error' ? '#fee2e2' : '#ffffff';

  return (
    <div 
      style={{ 
        minWidth: 280,
        maxWidth: 400,
        minHeight: 120,
        background: bgColor, 
        border: `2px solid ${borderColor}`, 
        borderRadius: 12, 
        boxShadow: selected ? '0 8px 24px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Resizer */}
      {selected && <NodeResizer minWidth={280} minHeight={120} />}

      {/* Handles */}
      <Handle type="target" position={Position.Left} style={{ left: -6, background: '#64748b' }} />
      <Handle type="source" position={Position.Right} style={{ right: -6, background: '#2563eb' }} />

      {/* Content - scrollable if too tall */}
      <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
            {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              background: editMode ? '#3b82f6' : '#f1f5f9',
              color: editMode ? '#fff' : '#64748b',
              border: 'none',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {editMode ? '✓ Done' : '⚙ Config'}
          </button>
        </div>

        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
            {/* Node Type Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Operation Type</label>
              <select 
                value={nodeType} 
                onChange={(e) => setNodeType(e.target.value as any)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
              >
                <option value="ingest">Ingest (Load Data)</option>
                <option value="filter">Filter (Subset Rows)</option>
                <option value="buffer">Buffer (Spatial)</option>
              </select>
            </div>

            {/* INPUT SOURCE (only for ingest) */}
            {nodeType === 'ingest' && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Input Source</label>
                <select 
                  value={inputSource} 
                  onChange={(e) => setInputSource(e.target.value as any)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                >
                  <option value="file">📁 File (Spatialite)</option>
                  <option value="sqlite">🗄️ SQLite Table</option>
                  <option value="connected">🔗 Connected Node</option>
                </select>

                {inputSource === 'file' && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fefce8', borderRadius: 6, fontSize: 10, color: '#854d0e' }}>
                    💡 Using: C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite
                  </div>
                )}

                {inputSource === 'sqlite' && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 4 }}>Table Name</label>
                    <select 
                      value={selectedSqliteTable} 
                      onChange={(e) => setSelectedSqliteTable(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                    >
                      <option value="">-- Select Table --</option>
                      {sqliteTables.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}

                {inputSource === 'connected' && (
                  <div style={{ marginTop: 8, padding: 8, background: '#eff6ff', borderRadius: 6, fontSize: 10, color: '#1e40af' }}>
                    {(() => {
                      const input = getConnectedInput();
                      return input 
                        ? `📊 Using: ${input.kind} "${input.kind === 'file' ? input.path : input.name}"`
                        : '⚠️ No node connected';
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* FILTER CONFIGURATION */}
            {(nodeType === 'filter' || nodeType === 'ingest') && (
              <>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Filter Column (optional)</label>
                  <select 
                    value={selectedColumn} 
                    onChange={(e) => {
                      setSelectedColumn(e.target.value);
                      setSelectedValues([]);
                    }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                  >
                    <option value="">-- No Filter --</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {selectedColumn && columnValues.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Select Values</label>
                    <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
                      {columnValues.map((val, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(val)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedValues([...selectedValues, val]);
                              } else {
                                setSelectedValues(selectedValues.filter(v => v !== val));
                              }
                            }}
                          />
                          <span>{String(val)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* BUFFER DISTANCE */}
            {nodeType === 'buffer' && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Buffer Distance (m)</label>
                <input
                  type="number"
                  value={bufferDistance}
                  onChange={(e) => setBufferDistance(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                />
              </div>
            )}

            {/* OUTPUT STORAGE MODE */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Output Storage</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ 
                  flex: 1, 
                  cursor: 'pointer', 
                  padding: '8px', 
                  borderRadius: 6, 
                  border: `2px solid ${outputMode === 'temporary' ? '#3b82f6' : '#e2e8f0'}`, 
                  background: outputMode === 'temporary' ? '#eff6ff' : '#fff',
                  textAlign: 'center',
                }}>
                  <input 
                    type="radio" 
                    checked={outputMode === 'temporary'} 
                    onChange={() => setOutputMode('temporary')}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: 11, fontWeight: 600 }}>⚡ Temp</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>In-memory</div>
                </label>
                <label style={{ 
                  flex: 1, 
                  cursor: 'pointer', 
                  padding: '8px', 
                  borderRadius: 6, 
                  border: `2px solid ${outputMode === 'persistent' ? '#3b82f6' : '#e2e8f0'}`, 
                  background: outputMode === 'persistent' ? '#eff6ff' : '#fff',
                  textAlign: 'center',
                }}>
                  <input 
                    type="radio" 
                    checked={outputMode === 'persistent'} 
                    onChange={() => setOutputMode('persistent')}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: 11, fontWeight: 600 }}>💾 Persist</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>Save to DB</div>
                </label>
              </div>

              {outputMode === 'persistent' && (
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="table_name (auto if empty)"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11 }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Result Display */}
            {lastResult && (
              <div style={{ 
                padding: '6px 8px', 
                background: status === 'error' ? '#fee2e2' : '#f0fdf4', 
                borderRadius: 6, 
                marginBottom: 8, 
                fontSize: 10, 
                color: status === 'error' ? '#b91c1c' : '#15803d',
              }}>
                {lastResult}
              </div>
            )}

            {/* Output Table Info */}
            {data.outputTable && (
              <div style={{ padding: '6px 8px', background: '#eff6ff', borderRadius: 6, marginBottom: 8, fontSize: 10, color: '#1e40af' }}>
                📊 {data.rowCount} rows → {data.outputTable.kind === 'temporary' ? 'temp' : data.outputTable.kind} 
                "{data.outputTable.kind === 'file' ? data.outputTable.path : data.outputTable.name}"
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={runNode}
              disabled={status === 'running'}
              style={{
                width: '100%',
                padding: '8px',
                background: status === 'running' ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: status === 'running' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {status === 'running' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
                    <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Running...
                </>
              ) : (
                <>▶ Run</>
              )}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
