# Table API Fix - December 16, 2025

## Problem

The TaskNode was trying to use `/tools/datasets/{name}/columns` API for **workspace tables**, but that endpoint only works for **predefined datasets** (like `water_points`, `water_lines` from the `DATASETS` dict).

### Error:
```
GET http://localhost:8000/tools/datasets/water_points_ingested/columns 404 (Not Found)
```

This happened because:
1. `listDestinationTables()` was **hardcoded** with example table names
2. When user selected a table, TaskNode tried to load columns using `getDatasetColumns()`
3. But those table names don't exist in the predefined `DATASETS` dictionary
4. Result: 404 error

## Root Cause

**Backend**: `list_destination_tables` was returning hardcoded examples instead of actual workspace tables:

```python
@router.get("/destination-tables")
async def list_destination_tables():
    # ❌ HARDCODED - not reading from workspace
    return {"tables": ["water_points_ingested", "water_lines_ingested", "combined_features"]}
```

**Frontend**: TaskNode was using dataset API for workspace tables:

```typescript
// ❌ WRONG - dataset API doesn't know about workspace tables
getDatasetColumns(selectedTable)  // Calls /tools/datasets/{name}/columns
```

## Solution

### 1. Backend: Added New Table Endpoints

Created 3 new endpoints in `backend/app/tools.py`:

#### `GET /tools/destination-tables` (Updated)
```python
@router.get("/destination-tables")
async def list_destination_tables():
    """
    Return all available tables from the workspace database.
    Now reads from actual workspace using ws.list_tables()
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite'
        
        with Workspace(db_path) as ws:
            tables = ws.list_tables()  # ✅ Real tables from workspace
            return {"tables": tables}
    except Exception as e:
        print(f"[ERROR] Failed to list tables: {e}")
        # Fallback to example tables if workspace fails
        return {"tables": ["water_points_fixed", "water_lines_fixed"]}
```

#### `GET /tools/tables/{table_name}/columns` (New)
```python
@router.get("/tables/{table_name}/columns")
async def get_table_columns(table_name: str):
    """
    Get columns for a specific table in the workspace database.
    Works for ANY table (persistent or temporary), not just predefined datasets.
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite'
        
        with Workspace(db_path) as ws:
            gdf = gpd.read_file(db_path, layer=table_name)
            columns = list(gdf.columns)
            return {"columns": columns}
    except Exception as e:
        return JSONResponse(
            content={"error": f"Table '{table_name}' not found"}, 
            status_code=404
        )
```

#### `GET /tools/tables/{table_name}/columns/{col}/values` (New)
```python
@router.get("/tables/{table_name}/columns/{col}/values")
async def get_table_column_values(table_name: str, col: str):
    """
    Get unique values for a column in a workspace table.
    Similar to dataset endpoint but works for actual workspace tables.
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk.sqlite'
        
        with Workspace(db_path) as ws:
            gdf = gpd.read_file(db_path, layer=table_name)
            
            if col not in gdf.columns:
                return JSONResponse(
                    content={"error": f"Column '{col}' not found"}, 
                    status_code=404
                )
            
            uniques = gdf[col].dropna().unique().tolist()
            if len(uniques) > 200:
                uniques = uniques[:200]
            
            return {"values": uniques}
    except Exception as e:
        return JSONResponse(
            content={"error": "Failed to read table or column"}, 
            status_code=500
        )
```

### 2. Frontend: Added New API Functions

Added in `src/lib/api.ts`:

```typescript
/**
 * Get columns for a workspace table (persistent or temporary).
 * This is different from getDatasetColumns which only works for predefined datasets.
 */
export async function getTableColumns(tableName: string) {
  const res = await fetch(`${BASE}/tools/tables/${encodeURIComponent(tableName)}/columns`);
  if (!res.ok) throw new Error(`Failed to get columns for table '${tableName}'`);
  return res.json();
}

/**
 * Get unique values for a column in a workspace table.
 * Similar to getDatasetColumnValues but works for actual workspace tables.
 */
export async function getTableColumnValues(tableName: string, columnName: string) {
  const res = await fetch(`${BASE}/tools/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}/values`);
  if (!res.ok) throw new Error(`Failed to get values for column '${columnName}' in table '${tableName}'`);
  return res.json();
}
```

### 3. TaskNode: Updated to Use Correct APIs

```typescript
// Import new functions
import { 
  listDatasets, 
  executeNodeOperation, 
  getDatasetColumns,      // ← Still available for legacy datasets
  getDatasetColumnValues, // ← Still available for legacy datasets
  listDestinationTables,
  getTableColumns,        // ← NEW: For workspace tables
  getTableColumnValues    // ← NEW: For workspace tables
} from '../../lib/api';

// Updated useEffect to use table API
useEffect(() => {
  if (nodeType === 'ingest' && selectedTable) {
    setColumns([]);
    setSelectedColumn('');
    setColumnValues([]);
    
    // ✅ Use getTableColumns for workspace tables
    getTableColumns(selectedTable)
      .then((result) => {
        setColumns(result.columns || []);
      })
      .catch((err) => {
        console.error('[TaskNode] Failed to load columns for table:', err);
        setColumns([]);
      });
  }
}, [selectedTable, nodeType]);

// Updated useEffect for column values
useEffect(() => {
  if (selectedColumn && selectedTable) {
    setColumnValues([]);
    setSelectedValues([]);
    
    // ✅ Use getTableColumnValues for workspace tables
    getTableColumnValues(selectedTable, selectedColumn)
      .then((result) => {
        setColumnValues(result.values || []);
      })
      .catch((err) => {
        console.error('[TaskNode] Failed to load column values:', err);
        setColumnValues([]);
      });
  }
}, [selectedColumn, selectedTable]);
```

## API Differences

### Dataset API (Legacy)
- **Purpose**: For predefined sample datasets in `DATASETS` dict
- **Endpoints**: 
  - `GET /tools/datasets` - List predefined datasets
  - `GET /tools/datasets/{name}/columns` - Get columns from dataset
  - `GET /tools/datasets/{name}/columns/{col}/values` - Get values from dataset
- **Usage**: Only works for `water_points`, `water_lines`, etc.

### Table API (New)
- **Purpose**: For actual workspace tables (SQLite + temp tables)
- **Endpoints**:
  - `GET /tools/destination-tables` - List all tables from workspace
  - `GET /tools/tables/{name}/columns` - Get columns from any table
  - `GET /tools/tables/{name}/columns/{col}/values` - Get values from any table
- **Usage**: Works for ANY table in the workspace database

## Testing Checklist

- [ ] Restart backend server: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
- [ ] Restart frontend: `bun dev`
- [ ] Open TaskNode config
- [ ] Select "Table" input source
- [ ] Verify dropdown shows actual tables from `3waters_wk.sqlite`
- [ ] Select a table (e.g., `water_points_fixed`)
- [ ] Verify columns load successfully (no 404 error)
- [ ] Select a column
- [ ] Verify values load successfully with checkboxes
- [ ] Run the ingest operation
- [ ] Verify data is loaded correctly

## Next Steps

1. **Remove hardcoded database path** - Replace with file browser or config
2. **Session integration** - Ensure temp tables appear in the table dropdown
3. **Cache table list** - Refresh when new tables are created
4. **Error handling** - Better UI feedback when workspace connection fails
