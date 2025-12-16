# restFlow - GitHub Copilot Instructions

## Project Overview

**restFlow** is a node-based workflow application for spatial data processing. It's designed as a **local-first, backend-agnostic** system that:

- Currently uses FastAPI + SQLite for rapid prototyping
- Is architected to support pure client-side execution with DuckDB WASM in the future
- Allows users to build spatial data workflows through a visual node graph
- Emphasizes minimal dependencies for potential desktop app packaging

---

## Core Architectural Philosophy

### 1. Backend-Agnostic Design (Future WASM Migration)

**Intent**: The application should work with EITHER a remote FastAPI backend OR pure client-side WASM execution without changing frontend code.

**Current State**:
- `src/lib/api.ts` makes direct `fetch()` calls to FastAPI endpoints
- Components like `TaskNode.tsx` call `runTool()` which hits HTTP endpoints

**Evolution Path** (DO NOT rewrite from scratch):
- Gradually introduce an **engine abstraction layer** (`src/lib/engine/`)
- Define operations as **data structures** (Command Pattern), not API calls
- Keep existing `api.ts` functions for backwards compatibility
- Add new engine-based functions alongside old ones
- Migrate components incrementally to use the abstraction

**Key Patterns**:
- **Strategy Pattern**: Swap execution engines (RemoteEngine ↔ WasmEngine)
- **Command Pattern**: Operations as serializable objects
- **Adapter Pattern**: Translate operations to backend-specific implementations

### 2. Session/Workspace Management

**Intent**: Support temporary vs. permanent data with transaction-like semantics.

**Concepts**:
- **Session**: A workflow execution context (like a database transaction)
- **Temporary Tables**: In-memory or temp storage during workflow execution
- **Commit/Rollback**: Materialize temp tables to permanent storage or discard them

**Current State**:
- Backend has basic session concept in `backend/app/db.py` (AsyncSession)
- No frontend session tracking yet
- Temp vs permanent tables not yet distinguished

**Evolution Path**:
- Add `SessionManager` class in backend (context manager pattern)
- Track temp table lifecycle (create → use → commit OR rollback)
- Add frontend session state (Jotai atom or React Context)
- Expose `/api/sessions` endpoints for create/destroy/commit/rollback

**DO NOT**:
- Use SQLAlchemy's Unit of Work pattern (too heavy for this use case)
- Add heavy ORMs or dependency injection frameworks
- Require backend session state if frontend can track it

### 3. Local-First + Minimal Dependencies

**Intent**: Keep the codebase lean enough to package as a desktop app with embedded WASM runtime.

**Current Dependencies** (keep lean):
- Frontend: React, ReactFlow (`@xyflow/react`), Vite
- Backend: FastAPI, GeoPandas, SQLite/SpatiaLite
- Future: DuckDB WASM, browser-fs-access

**Constraints**:
- Avoid heavy frameworks (Redux, MobX, complex DI containers)
- Prefer vanilla TypeScript/Python patterns
- Keep bundle size small (WASM payloads are large enough)
- Design for offline-capable operation

---

## Current Codebase Structure

### Frontend (`src/`)

```
src/
├── lib/
│   └── api.ts              # Direct fetch() calls to FastAPI
├── components/
│   ├── WorkflowPanel/
│   │   ├── index.tsx       # Owns nodes state, renders canvas
│   │   └── TaskNode.tsx    # Node UI with edit mode, runs tools
│   ├── WorkflowCanvas.tsx  # ReactFlow wrapper
│   ├── FileBrowser/        # File picker modal
│   ├── TopBar/             # Header with file open
│   └── Layout.tsx          # App shell
└── main.tsx                # Entry point
```

**Key Files**:
- **`api.ts`**: Current API layer (direct HTTP calls). Will evolve to use engine abstraction.
- **`TaskNode.tsx`**: Visual node component. Calls `runTool()` on Run button. Contains filter UI (dataset/column/values selection).
- **`WorkflowPanel/index.tsx`**: Manages nodes/edges state with `useNodesState` and `useEdgesState` from ReactFlow.

### Backend (`backend/app/`)

```
backend/app/
├── main.py              # FastAPI app, workflow CRUD, node types
├── db.py                # SQLAlchemy async engine and session
├── database_models.py   # ORM models (WorkflowDB, NodeDB, etc.)
├── models.py            # Pydantic schemas (request/response)
├── tools.py             # Tools router (/tools/ingest, /tools/datasets)
└── executors.py         # Node executor registry (pluggable)
```

**Key Files**:
- **`main.py`**: FastAPI app with `/api/workflows` CRUD and `/api/nodes/types` for node metadata.
- **`tools.py`**: Implements `/tools/ingest` and `/tools/ingest-table` with filtering logic. Uses GeoPandas + SpatiaLite.
- **`db.py`**: Async SQLAlchemy setup. Default DB is `backend/dev.db` (absolute path to avoid cwd issues).

---

## Design Patterns & Guidelines

### When Adding New Features

#### ✅ DO:

1. **Adapt existing code incrementally**
   - Add new functions alongside old ones (don't delete working code)
   - Use feature flags or optional parameters to introduce changes
   - Maintain backwards compatibility during migration

2. **Use lightweight patterns**
   - **Repository Pattern** for data access (not full UoW)
   - **Command Pattern** for operations (serializable objects)
   - **Strategy Pattern** for swappable implementations
   - **Context Manager** for resource lifecycle (sessions, connections)

3. **Comment extensively for frontend newcomers**
   - Assume reader is new to React/TypeScript
   - Explain WHY a pattern is used, not just WHAT
   - Use analogies (e.g., "Session is like a shopping cart...")
   - Document API contracts in JSDoc/docstrings

4. **Keep operations as data structures**
   ```typescript
   // ✅ Good: Serializable, engine-agnostic
   const operation = {
     type: 'filter',
     input: { kind: 'persistent', name: 'water_points' },
     filters: [{ column: 'status', operator: 'equals', value: 'active' }]
   };
   await engine.executeOperation(sessionId, operation);
   ```

   ```typescript
   // ❌ Bad: Coupled to HTTP, not composable
   await fetch('/tools/filter', {
     body: JSON.stringify({ table: 'water_points', status: 'active' })
   });
   ```

5. **Design for both remote and local execution**
   - Operations should work identically whether executed by FastAPI or DuckDB WASM
   - Abstract storage locations (file path, SQLite table, IndexedDB, memory)
   - Use `TableRef` type to point to data without loading it

#### ❌ DON'T:

1. **Don't rewrite from scratch**
   - Current code works; evolve it gradually
   - Preserve existing API functions during migration
   - Add deprecation comments, not deletions

2. **Don't add heavy dependencies**
   - No Redux, MobX, complex state management
   - No SQLAlchemy advanced features (avoid full UoW, complex relationships)
   - Prefer stdlib/builtin solutions

3. **Don't couple nodes to backend APIs**
   - Nodes should emit/consume data references, not make HTTP calls
   - Use the engine abstraction layer
   - Keep business logic in operations, not in components

4. **Don't assume backend availability**
   - Design for eventual offline mode
   - Make remote calls optional (degrade gracefully)
   - Cache metadata locally when possible

---

## Coding Standards

### TypeScript

```typescript
/**
 * EXAMPLE: Well-commented operation for beginners
 * 
 * FilterOperation - Remove rows that don't match criteria
 * 
 * WHY WE NEED THIS:
 * In a spatial workflow, you often want to work with a subset of data.
 * Instead of loading millions of rows, we filter early.
 * 
 * HOW IT WORKS:
 * - Takes an input table reference (could be in SQLite, memory, or a file)
 * - Applies filters (like SQL WHERE clauses)
 * - Returns a new table with only matching rows
 * 
 * ANALOGY:
 * Think of this like filtering emails:
 * - Input: All emails in your inbox
 * - Filter: { from: 'boss@company.com', unread: true }
 * - Output: Unread emails from your boss
 */
export interface FilterOperation {
  type: 'filter';
  
  /** 
   * Where to read data from
   * Could be:
   * - { kind: 'persistent', name: 'water_points' } → SQLite table
   * - { kind: 'temporary', name: 'temp_xyz', sessionId } → Temp table in session
   * - { kind: 'file', path: '/path/to/data.gpkg' } → File on disk
   */
  input: TableRef;
  
  /**
   * Conditions to match (all must be true = AND logic)
   * Example: [
   *   { column: 'status', operator: 'equals', value: 'active' },
   *   { column: 'population', operator: 'greater_than', value: 10000 }
   * ]
   * SQL equivalent: WHERE status = 'active' AND population > 10000
   */
  filters: Filter[];
  
  /**
   * Optional custom name for output table
   * If not provided, engine generates a temp name like "temp_abc123"
   */
  destination?: string;
}
```

### Python

```python
def execute_filter_operation(session: WorkspaceSession, op: FilterOperation) -> OperationResult:
    """
    Execute a filter operation on a table.
    
    ARCHITECTURE NOTE:
    This function is part of the backend implementation of IDataEngine.
    It translates a FilterOperation (data structure) into actual SQL/pandas logic.
    
    The same FilterOperation could be executed by:
    - This FastAPI backend (using GeoPandas/SQLite)
    - A WASM engine in the browser (using DuckDB SQL)
    
    That's why operations are defined as plain objects - they're implementation-agnostic!
    
    Args:
        session: Workspace session (tracks temp tables)
        op: FilterOperation object with input table and filter criteria
    
    Returns:
        OperationResult with reference to output table and row count
    
    Example:
        >>> op = FilterOperation(
        ...     type='filter',
        ...     input={'kind': 'persistent', 'name': 'water_points'},
        ...     filters=[{'column': 'status', 'operator': 'equals', 'value': 'active'}]
        ... )
        >>> result = execute_filter_operation(session, op)
        >>> result.outputTable
        {'kind': 'temporary', 'name': 'temp_xyz789', 'sessionId': 'abc-123'}
    """
    # Implementation...
```

---

## Migration Checklist (Evolve, Don't Rewrite)

### Phase 1: Add Engine Abstraction (keep existing code)

- [ ] Create `src/lib/engine/types.ts` with `IDataEngine` interface
- [ ] Create `src/lib/engine/operations.ts` with operation type definitions
- [ ] Create `src/lib/engine/remote-engine.ts` implementing `IDataEngine` via HTTP
- [ ] Add `initEngine()` to `api.ts` (don't remove existing functions)
- [ ] Add new `executeNodeOperation()` function alongside `runTool()`

### Phase 2: Backend Session Support

- [ ] Add `SessionManager` class in `backend/app/session.py`
- [ ] Create `/api/sessions` endpoints (POST, DELETE, GET)
- [ ] Track temporary vs permanent tables in session state
- [ ] Add `/api/sessions/{id}/execute` endpoint that dispatches operations
- [ ] Implement commit/rollback logic (rename temp → permanent OR drop)

### Phase 3: Incremental Component Migration

- [ ] Add session state to `WorkflowPanel` (Jotai atom or useState)
- [ ] Update `TaskNode` to optionally use `executeNodeOperation()` instead of `runTool()`
- [ ] Add "Commit Workflow" button that calls session commit
- [ ] Show temp vs permanent tables in UI

### Phase 4: WASM Preparation (future)

- [ ] Create `src/lib/engine/wasm-engine.ts` (stub for now)
- [ ] Add DuckDB WASM as optional dependency
- [ ] Implement basic WASM operations (ingest, filter) using DuckDB
- [ ] Add mode selector: "Cloud Mode" vs "Local Mode"

---

## Common Tasks & How to Approach Them

### Task: "Add a new spatial operation (e.g., buffer)"

1. **Define the operation** in `src/lib/engine/operations.ts`:
   ```typescript
   export interface BufferOperation {
     type: 'buffer';
     input: TableRef;
     distance: number;  // meters
     destination?: string;
   }
   ```

2. **Add to Operation union**:
   ```typescript
   export type Operation = ... | BufferOperation;
   ```

3. **Implement backend executor** in `backend/app/executors.py` or `tools.py`:
   ```python
   def execute_buffer(session, op: dict) -> dict:
       input_table = resolve_table_ref(session, op['input'])
       gdf = gpd.read_file(input_table)
       buffered = gdf.copy()
       buffered['geometry'] = gdf.geometry.buffer(op['distance'])
       temp_name = create_temp_table(session, buffered)
       return {'outputTable': {'kind': 'temporary', 'name': temp_name, 'sessionId': session.id}}
   ```

4. **Update TaskNode UI** (if needed) to configure buffer distance

5. **Keep it simple**: Don't add complex validation or optimization until it works

### Task: "Fix a bug in filtering"

1. **Check the data flow**:
   - Frontend: What payload is `TaskNode` sending? (DevTools Network tab)
   - Backend: Is `tools.py` receiving correct column/values? (Add logging)
   - Data transform: Is `gdf[gdf[col].isin(values)]` working? (Check dtypes)

2. **Add debug logging**:
   ```python
   print(f"[DEBUG] Filtering {len(gdf)} rows by {col} in {values}")
   filtered = gdf[gdf[col].isin(values)]
   print(f"[DEBUG] Result: {len(filtered)} rows")
   ```

3. **Return diagnostics** in response:
   ```python
   return {
     'status': 'ok',
     'original_rows': len(gdf),
     'filtered_rows': len(filtered),
     'sample': filtered.head(3).to_dict(orient='records')
   }
   ```

4. **Fix root cause**, don't add workarounds

### Task: "Add a new frontend component"

1. **Start simple**: Copy an existing component structure
2. **Comment extensively**: Explain what each section does (assume reader is new to React)
3. **Use existing patterns**: If `TaskNode` uses `useState`, use `useState` (don't introduce new patterns)
4. **Style consistently**: Match existing inline styles or CSS patterns
5. **Test in isolation**: Create a simple wrapper to test the component alone

---

## Anti-Patterns to Avoid

### ❌ Over-Engineering

```typescript
// ❌ Too complex for current needs
class AbstractOperationFactoryBuilder {
  createFactory(): OperationFactory {
    return new ConcreteOperationFactory(
      new DependencyInjectionContainer()
    );
  }
}
```

```typescript
// ✅ Simple and clear
function createFilterOperation(input: TableRef, filters: Filter[]): FilterOperation {
  return { type: 'filter', input, filters };
}
```

### ❌ Premature Optimization

```python
# ❌ Don't add caching/batching/pooling until you measure a problem
@lru_cache(maxsize=1000)
@batch_requests(batch_size=10)
def get_dataset_columns(name: str):
    ...
```

```python
# ✅ Start simple, optimize when needed
def get_dataset_columns(name: str):
    gdf = gpd.read_file(DATASETS[name])
    return list(gdf.columns)
```

### ❌ Coupling to Implementation Details

```typescript
// ❌ Node knows about HTTP details
async function runNode() {
  const res = await fetch('http://localhost:8000/tools/filter', {
    method: 'POST',
    body: JSON.stringify({ table: 'water_points' })
  });
}
```

```typescript
// ✅ Node uses abstraction
async function runNode() {
  const operation: FilterOperation = {
    type: 'filter',
    input: { kind: 'persistent', name: 'water_points' },
    filters: [...]
  };
  const result = await engine.executeOperation(sessionId, operation);
}
```

---

## File Organization Rules

### When creating new files:

1. **Frontend**:
   - Components go in `src/components/<ComponentName>/index.tsx`
   - Shared types in `src/types/` (create if needed)
   - Engine code in `src/lib/engine/`
   - Keep `src/lib/api.ts` as the public API facade

2. **Backend**:
   - Routes/endpoints in `backend/app/<domain>.py` (e.g., `tools.py`, `workflows.py`)
   - Business logic in separate modules (e.g., `executors.py`, `session.py`)
   - Keep `main.py` lean (just app setup and top-level routes)

3. **Documentation**:
   - Architecture docs in repo root (e.g., `architecture_idea.md`)
   - Inline comments for complex logic
   - Type annotations everywhere (TypeScript + Python)

---

## Testing Philosophy

### Current State: Minimal Automated Tests

**Approach**: Manual testing + defensive programming

1. **Defensive coding**:
   - Validate inputs at API boundaries
   - Return detailed error messages
   - Log suspicious states

2. **Manual testing checklist** (when adding features):
   - Test happy path
   - Test with empty/null inputs
   - Test with large datasets (if applicable)
   - Check DevTools Network/Console for errors

3. **Future**: Add tests incrementally
   - Start with critical paths (filtering, ingestion)
   - Use pytest for backend, Vitest for frontend
   - Don't block features on test coverage

---

## Common Pitfalls (Specific to This Project)

### 1. Type Coercion in Filters

**Problem**: Frontend sends `values: ["123"]` (strings) but backend column is numeric.

**Solution**: Backend coerces values to column dtype:
```python
if pd.api.types.is_integer_dtype(gdf[col]):
    values = [int(v) for v in values]
elif pd.api.types.is_float_dtype(gdf[col]):
    values = [float(v) for v in values]
```

See `backend/app/tools.py` for full implementation.

### 2. SQLite File Path Issues

**Problem**: `sqlite3.OperationalError: unable to open database file`

**Solution**: Use absolute paths in `db.py`:
```python
default_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dev.db'))
```

### 3. ReactFlow State Management

**Problem**: Nodes don't update when state changes.

**Solution**: Use controlled state from parent component:
```typescript
// In WorkflowPanel/index.tsx
const [nodes, setNodes] = useNodesState([]);
<WorkflowCanvas nodes={nodes} setNodes={setNodes} />
```

### 4. CORS Issues (Frontend ↔ Backend)

**Problem**: Browser blocks requests to `localhost:8000` from `localhost:5173`.

**Solution**: Add CORS middleware in `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Resources & References

- **ReactFlow Docs**: https://reactflow.dev/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **DuckDB WASM**: https://github.com/duckdb/duckdb-wasm
- **Command Pattern**: https://refactoring.guru/design-patterns/command
- **Repository Pattern**: https://martinfowler.com/eaaCatalog/repository.html

---

## Summary: Key Principles

1. **Evolve, don't rewrite**: Adapt existing code incrementally
2. **Backend-agnostic**: Design for both remote and WASM execution
3. **Operations as data**: Use Command Pattern for composability
4. **Session-based**: Track temporary vs permanent state
5. **Minimal dependencies**: Keep it light for desktop packaging
6. **Comment extensively**: Assume readers are frontend/backend newcomers
7. **Local-first**: Design for offline-capable operation
8. **Practical over perfect**: Ship working code, optimize later

---

**When in doubt**: Prefer simple, working solutions over complex architectures. This is a prototype that will evolve into production. Start with the simplest thing that could work, then refactor when you understand the problem better.
