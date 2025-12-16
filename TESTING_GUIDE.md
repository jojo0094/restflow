# Testing Guide - New Engine API

This guide walks through testing the new backend-agnostic engine architecture with a real workflow.

## Prerequisites

1. **Backend running**: Make sure the FastAPI backend is running
   ```powershell
   cd backend
   uv run uvicorn app.main:app --reload
   ```

2. **Frontend running**: Make sure the Vite dev server is running
   ```powershell
   bun run dev
   ```

## Test Workflow: Ingest → Filter → Buffer → Commit

This test validates:
- ✅ Session creation/cleanup
- ✅ Temporary table management
- ✅ Operation chaining (output → input)
- ✅ Filter/Buffer executors
- ✅ Commit to permanent storage

### Step 1: Create Ingest Node

1. Click "Add Ingest Node" button in toolbar
2. Click the ⚙ button on the node to configure
3. Select a dataset (e.g., `water_points`)
4. Optionally add a filter:
   - Select a column (e.g., `status`)
   - Select values to include (e.g., `active`)
5. Check "Use New Engine API" checkbox ✨
6. Click "Done"
7. Click "▶ Run" button

**Expected Result:**
- Node shows green checkmark ✓
- Shows message like "Ingested 150 rows"
- Shows blue info box: "📊 Output: temp table 'temp_abc123' (150 rows)"

### Step 2: Create Filter Node

1. Click "Add Ingest Node" again (we'll repurpose it)
2. Configure as filter:
   - In edit mode, change "Node Type" to "Filter"
   - Select column to filter (e.g., `type`)
   - Select values (e.g., `well`, `borehole`)
3. Check "Use New Engine API"
4. Click "Done"

**Important:** For now, you need to manually connect nodes. We'll need to:
- Either implement node chaining via edges in ReactFlow
- Or manually pass the `outputTable` from step 1 to the filter node's `data`

**Expected Result:**
- Shows filtered row count
- Creates new temp table with filtered results

### Step 3: Create Buffer Node

1. Add another node
2. Configure as buffer:
   - Change "Node Type" to "Buffer" (if available)
   - Set distance (e.g., 100 meters)
3. Check "Use New Engine API"
4. Pass input table from filter node
5. Run

**Expected Result:**
- Shows buffered feature count
- Creates new temp table with buffered geometries

### Step 4: Commit to Permanent Table

1. Click "💾 Commit Results" button in right panel
2. Enter the final table name (e.g., `my_buffered_wells`)
3. Enter the temporary table name from the last node output (e.g., `temp_xyz789`)
4. Click OK

**Expected Result:**
- Success message: "✓ Successfully committed temporary table 'temp_xyz789' to 'my_buffered_wells'"
- Table is now permanent and survives session cleanup

## Verification

### Check Session State

Open browser console and look for:
```
[WorkflowPanel] Created session: <session-id>
```

### Check Backend Logs

Backend should show:
```
INFO: Session created: <session-id>
INFO: Executing ingest operation
INFO: Ingested 150 rows to temp_abc123
INFO: Executing filter operation
INFO: Filtered to 50 rows (from 150)
INFO: Executing buffer operation
INFO: Buffered 50 features by 100 units
INFO: Committed temp_xyz789 to my_buffered_wells
```

### Check Database

After commit, query the database to verify:
```python
import geopandas as gpd
gdf = gpd.read_file("backend/data.db", layer="my_buffered_wells")
print(gdf.head())
```

## Known Limitations (Current Implementation)

1. **Manual Node Chaining**: Nodes don't automatically pass outputs to connected nodes yet
   - Need to implement ReactFlow edge handling
   - For now, you can manually set `data.outputTable` in React DevTools

2. **No Visual Connection**: Edges are visual only, not functional
   - Need to traverse the graph and build execution plan

3. **Simple Commit UI**: Uses prompt() dialogs
   - Should be replaced with proper modal component

4. **No Rollback Button**: Only commit is implemented
   - Should add "Discard Changes" button that calls `rollbackWorkflowSession(sessionId)`

## Next Steps

- [ ] Implement automatic node chaining via ReactFlow edges
- [ ] Add rollback button
- [ ] Improve commit UI with modal and table selector
- [ ] Add session info display (temp table list, row counts)
- [ ] Add export operation support
- [ ] Add join/aggregate operations

## Troubleshooting

### "No active session" error
**Cause**: Session wasn't created or was destroyed  
**Fix**: Refresh page to trigger session creation

### "Filter requires an input table" error
**Cause**: Filter node doesn't have input from previous node  
**Fix**: Manually set `data.outputTable` or implement edge handling

### Backend 500 error
**Cause**: Operation executor failed (check backend logs)  
**Fix**: 
- Verify dataset exists
- Check column names are correct
- Ensure geometry column exists for buffer

### Temp table not found
**Cause**: Session was destroyed before commit  
**Fix**: Don't refresh page or navigate away before committing

## Success Criteria ✓

You've successfully validated the architecture when:
- [x] Session is created automatically on mount
- [x] Ingest creates temporary table
- [x] Filter reads temp table and creates new temp table
- [x] Buffer reads temp table and creates buffered temp table
- [x] Commit materializes temp table to permanent storage
- [x] Session cleanup removes all temp tables on unmount
