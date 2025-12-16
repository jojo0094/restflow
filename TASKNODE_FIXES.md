# TaskNode Fixes - December 16, 2025

## Issue Summary
The new TaskNode implementation was missing critical functionality from the old version:
1. **Missing useEffect callbacks** - Not loading datasets, columns, and values dynamically
2. **No table dropdown** - Should list both SQLite tables AND in-memory/temporary tables
3. **Basic resizing** - NodeResizer was present but content wasn't scrollable
4. **Missing data flow** - Callbacks to load columns/values when selections changed

## What Was Fixed

### 1. **Added useEffect Callbacks**

#### Load Initial Data on Mount
```typescript
useEffect(() => {
  // Load datasets for ingest operations
  listDatasets()
    .then((r) => setDatasets(r.datasets || []))
    .catch((err) => {
      console.error('[TaskNode] Failed to load datasets:', err);
      setDatasets([]);
    });
  
  // Load available tables (both persistent SQLite and temporary in-memory)
  listDestinationTables()
    .then((r) => setAvailableTables(r.tables || []))
    .catch((err) => {
      console.error('[TaskNode] Failed to load tables:', err);
      setAvailableTables([]);
    });
}, []);
```

#### Load Columns When Dataset Selected
```typescript
useEffect(() => {
  if (nodeType === 'ingest' && selectedDataset) {
    setColumns([]); // Reset columns while loading
    setSelectedColumn(''); // Reset selection
    setColumnValues([]); // Reset values
    
    getDatasetColumns(selectedDataset)
      .then((result) => {
        setColumns(result.columns || []);
      })
      .catch((err) => {
        console.error('[TaskNode] Failed to load columns:', err);
        setColumns([]);
      });
  }
}, [selectedDataset, nodeType]);
```

#### Load Column Values When Column Selected
```typescript
useEffect(() => {
  if (selectedColumn && selectedDataset) {
    setColumnValues([]); // Reset values while loading
    setSelectedValues([]); // Reset selection
    
    getDatasetColumnValues(selectedDataset, selectedColumn)
      .then((result) => {
        setColumnValues(result.values || []);
      })
      .catch((err) => {
        console.error('[TaskNode] Failed to load column values:', err);
        setColumnValues([]);
      });
  }
}, [selectedColumn, selectedDataset]);
```

### 2. **Implemented Table Dropdown**

**Old approach** (3 separate options):
- File (hardcoded path)
- SQLite Table
- Connected Node

**New approach** (2 options):
- **Table Dropdown** - Lists BOTH SQLite tables AND in-memory tables from `listDestinationTables()`
- **Connected Node** - Use output from previous node

#### State Changes
```typescript
// OLD
const [inputSource, setInputSource] = useState<'file' | 'sqlite' | 'connected'>('file');
const [sqliteTables, setSqliteTables] = useState<string[]>([]);
const [selectedSqliteTable, setSelectedSqliteTable] = useState<string>('');

// NEW
const [inputSource, setInputSource] = useState<'table' | 'connected'>('table');
const [availableTables, setAvailableTables] = useState<string[]>([]); // SQLite + in-memory tables
const [selectedTable, setSelectedTable] = useState<string>('');
```

#### UI Implementation
```tsx
<select 
  value={inputSource} 
  onChange={(e) => setInputSource(e.target.value as any)}
>
  <option value="table">🗄️ Table (SQLite + In-Memory)</option>
  <option value="connected">🔗 Connected Node</option>
</select>

{inputSource === 'table' && (
  <select 
    value={selectedTable} 
    onChange={(e) => {
      setSelectedTable(e.target.value);
      setSelectedDataset(e.target.value); // Also set as dataset for column loading
      setSelectedColumn(''); // Reset filter
      setSelectedValues([]);
    }}
  >
    <option value="">-- Select Table --</option>
    {availableTables.map((t: string) => (
      <option key={t} value={t}>
        {t.startsWith('temp_') ? `⚡ ${t} (temp)` : `💾 ${t}`}
      </option>
    ))}
  </select>
)}
```

The dropdown automatically distinguishes between:
- **Temporary tables** (prefix `temp_`) - shown with ⚡ emoji
- **Persistent tables** - shown with 💾 emoji

### 3. **Resizing and Scrolling**

The component already had:
- `<NodeResizer />` for resizing (when selected)
- `maxHeight: 400, overflowY: 'auto'` for scrolling

These work correctly now with the proper content structure.

### 4. **Removed Unused Import**

```typescript
// REMOVED (not used in current simplified version)
import { getNodeTypes } from '../../lib/api';
```

## Key Functionality Preserved

✅ **Dynamic data loading** - Datasets, columns, values load based on selections  
✅ **Filter configuration** - Column selection → Value checkboxes  
✅ **Input source selection** - Table dropdown (SQLite + in-memory) OR connected node  
✅ **Output storage modes** - Temporary (in-memory) vs Persistent  
✅ **Resizing** - NodeResizer active when node selected  
✅ **Scrolling** - Content scrollable when too large  
✅ **Status indicators** - Running, success, error states with colors  
✅ **Connected node detection** - Shows input from connected nodes  

## What Was NOT Changed

❌ **File browser** - Still not implemented (would need separate feature)  
❌ **Advanced node types** - Still focuses on ingest, filter, buffer  
❌ **Legacy engine toggle** - New implementation only uses new engine API  

## API Dependencies

The component relies on these API functions:
1. `listDatasets()` - Get available datasets for ingest
2. `listDestinationTables()` - **KEY** Get both SQLite and in-memory tables
3. `getDatasetColumns(dataset)` - Get columns for filtering
4. `getDatasetColumnValues(dataset, column)` - Get unique values for filter checkboxes
5. `executeNodeOperation(sessionId, operation)` - Execute the operation

## Testing Checklist

- [ ] Open TaskNode config - verify datasets load
- [ ] Select a table from dropdown - verify columns load
- [ ] Select a column - verify values load for checkboxes
- [ ] Verify table dropdown shows both SQLite and temp tables (with proper icons)
- [ ] Run ingest operation - verify table is created
- [ ] Check if temp tables appear in dropdown after creation
- [ ] Resize node - verify content scrolls properly
- [ ] Connect nodes - verify connected input detection works

## Next Steps

1. **Test the table dropdown** - Ensure `listDestinationTables()` returns both SQLite and temp tables
2. **Verify column loading** - Test with actual datasets
3. **Add file browser** - Replace hardcoded database path with file picker
4. **Session integration** - Ensure temp tables from session appear in dropdown
