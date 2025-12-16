# TaskNode V2 - Clean UI/UX Implementation

## Overview
Completely redesigned TaskNode component with clean, compact UI and proper input/output management.

## Key Features Implemented

### 1. **Input Source Management** (for Ingest nodes)
- **File Input**: Hardcoded Spatialite database path (`C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite`)
- **SQLite Table**: Dropdown list of available tables (`water_points_fixed`, `water_lines_fixed`)
- **Connected Node**: Uses output from upstream node (via ReactFlow edges)

### 2. **Clean, Compact UI**
- Resizable nodes with `NodeResizer` (min 280x120)
- Scrollable content area with custom scrollbar styling
- Config/Edit mode toggle
- No messy collapsed/uncollapsed UI - everything is clean and organized

### 3. **Filter Configuration** (optional for Ingest/Filter nodes)
- Column selection dropdown
- Value selection with checkboxes (scrollable list, max-height 120px)
- Only shows when column is selected

### 4. **Output Storage Modes**
- **⚡ Temporary**: In-memory temp tables (auto-generated names)
- **💾 Persistent**: Saved to database with custom name (or auto-generated)
- Visual radio button selection with clear labels

### 5. **Node Operations**
- **Ingest**: Load data from file/sqlite/connected node
- **Filter**: Subset rows based on criteria
- **Buffer**: Spatial buffer operation with distance parameter

### 6. **Status Indicators**
- Border colors change based on status (running=blue, success=green, error=red)
- Background colors match status
- Spinning loader icon during execution
- Result messages show row count and storage mode

### 7. **Vertical Scrollbar**
- Content area has `maxHeight: 400px` with `overflowY: 'auto'`
- Custom styled scrollbar (6px wide, rounded, modern look)
- Only appears when content exceeds height

## UI/UX Improvements

### Compact Design
- No unnecessary spacing
- Clear labels with proper hierarchy (fontWeight: 600 for labels)
- Color-coded sections (info boxes use bg colors: yellow for warnings, blue for info)

### Responsive Layout
- Min/max widths prevent nodes from being too small or too large
- Resizer allows user to adjust height for long filter lists
- Scrollbar prevents overflow

### Visual Feedback
- Selected nodes show stronger shadow and blue border
- Running state shows animated spinner
- Success/error states show with appropriate colors
- Output table info displayed in compact format

## Data Flow

```
┌─────────────────┐
│   Input Source  │
│  (File/SQLite/  │
│   Connected)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filter (opt.)  │
│  Column/Values  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Operation     │
│ (Ingest/Filter/ │
│     Buffer)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Output Storage  │
│  (Temp/Persist) │
└─────────────────┘
```

## Code Structure

### State Management
```typescript
// Node configuration
const [nodeType, setNodeType] = useState('ingest');
const [outputMode, setOutputMode] = useState<'temporary' | 'persistent'>('temporary');
const [inputSource, setInputSource] = useState<'file' | 'sqlite' | 'connected'>('file');

// Filter configuration
const [selectedColumn, setSelectedColumn] = useState('');
const [selectedValues, setSelectedValues] = useState<any[]>([]);

// Buffer configuration
const [bufferDistance, setBufferDistance] = useState(100);
```

### Operation Execution
```typescript
async function runNode() {
  if (!sessionId) throw new Error('No active session');
  
  // Build operation based on nodeType
  if (nodeType === 'ingest') {
    const operation: IngestOperation = { ... };
    result = await executeNodeOperation(sessionId, operation);
  } else if (nodeType === 'filter') {
    const operation: FilterOperation = { ... };
    result = await executeNodeOperation(sessionId, operation);
  } else if (nodeType === 'buffer') {
    const operation: BufferOperation = { ... };
    result = await executeNodeOperation(sessionId, operation);
  }
  
  // Store result in node data
  data.outputTable = result.outputTable;
  data.rowCount = result.rowCount;
}
```

## Hardcoded Values (To Be Replaced Later)

### Spatialite Database Path
```typescript
// Current: Hardcoded
source = { kind: 'file', path: 'C:\\Users\\jkyawkyaw\\.spatialite_databases\\3waters_wk.sqlite' };

// Future: File browser integration
source = { kind: 'file', path: selectedFilePath };
```

### SQLite Tables
```typescript
// Current: Mock data
setSqliteTables(['water_points_fixed', 'water_lines_fixed']);

// Future: Load from backend API
const tables = await loadSqliteTables(dbPath);
setSqliteTables(tables);
```

## Backend Integration

### Expected API Call (Example)
```python
# In backend (hypothetical)
from workspace import Workspace
from reader import ReaderApp

db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite'
ws = Workspace(db_path)

with ws:
    app = ReaderApp(ws)
    points_gdf = app.read_as_gdf('water_points_fixed')
    lines_gdf = app.read_as_gdf('water_lines_fixed')
```

### Current API Usage
```typescript
// Frontend calls
const operation: IngestOperation = {
  type: 'ingest',
  source: { kind: 'file', path: dbPath },
  filters: [...],
  destination: outputMode === 'persistent' ? outputName : undefined,
};

const result = await executeNodeOperation(sessionId, operation);
```

## Migration from Old TaskNode

### What Was Removed
- Legacy engine toggle (removed `useNewEngine` - now always uses new engine)
- Complex nested UI with multiple config sections
- Messy input/output controls with unclear labels
- Manual table reference input (simplified to input source dropdown)

### What Was Improved
- **Input Source**: Clear dropdown (File/SQLite/Connected) instead of radio buttons
- **Filter UI**: Scrollable checkbox list instead of large list
- **Output Mode**: Visual radio buttons instead of dropdown + checkbox
- **Config Mode**: Single toggle button instead of confusing multi-step UI
- **Vertical Scrolling**: Added to prevent UI overflow

## Testing Checklist

### Ingest Operation
- [ ] Select "File" input → should show hardcoded path
- [ ] Select "SQLite Table" input → should show dropdown with tables
- [ ] Select "Connected" input → should show connected node info or warning
- [ ] Apply filter (optional) → select column and values
- [ ] Select "Temp" output → run and verify temp table created
- [ ] Select "Persist" output → enter name and verify saved to database

### Filter Operation
- [ ] Connect to upstream node → should detect input
- [ ] Apply filter → select column and values
- [ ] Verify output shows filtered row count

### Buffer Operation
- [ ] Connect to upstream node → should detect input
- [ ] Set buffer distance → default 100m
- [ ] Verify output shows buffered features

### UI/UX
- [ ] Resize node → should maintain layout
- [ ] Scroll long filter list → scrollbar should appear
- [ ] Edit mode toggle → should switch cleanly
- [ ] Run operation → should show spinner and result
- [ ] Error handling → should show red border and error message

## Known Limitations

1. **Hardcoded Database Path**: Currently using a fixed path for Spatialite database
2. **Mock SQLite Tables**: Table list is hardcoded, should be loaded dynamically
3. **No File Browser**: Need to integrate file browser for selecting database files
4. **Filter Columns**: Only loaded for datasets, need to load for SQLite tables too
5. **No Bbox Input**: Spatial bounding box filter UI not yet implemented

## Next Steps

1. **File Browser Integration**: Replace hardcoded path with file browser
2. **Dynamic Table Loading**: Load SQLite tables from backend API
3. **Column Introspection**: Load columns for SQLite tables (not just datasets)
4. **Bbox Filter UI**: Add spatial bounding box input (collapsible min/max x/y)
5. **Commit Modal**: UI for committing temp tables to persistent storage
6. **Preview Panel**: Show data preview in node or separate panel

## Summary

✅ **Completed**:
- Clean, compact node UI with resizable layout
- Input source selection (File/SQLite/Connected)
- Filter configuration with scrollable value list
- Output storage mode selection (Temp/Persistent)
- Vertical scrollbar for overflow content
- Status indicators and result display
- Operation execution (Ingest/Filter/Buffer)

⏳ **Pending**:
- File browser integration
- Dynamic SQLite table loading
- Bbox filter UI
- Commit workflow modal
