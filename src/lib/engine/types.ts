/**
 * ENGINE TYPES - Core Abstractions for Backend-Agnostic Data Operations
 * 
 * This file defines the fundamental interfaces that allow our workflow app to work
 * with EITHER a remote FastAPI backend OR local DuckDB WASM, without changing any
 * frontend code.
 * 
 * KEY CONCEPTS FOR BEGINNERS:
 * 
 * 1. INTERFACE vs CLASS:
 *    - An interface is like a contract: "any engine MUST have these methods"
 *    - We can have multiple implementations (RemoteEngine, WasmEngine)
 *    - TypeScript ensures they all follow the same contract
 * 
 * 2. SESSION CONCEPT:
 *    - Think of a session like a "workspace" or "transaction"
 *    - It holds temporary tables that haven't been saved yet
 *    - When you "commit", temp tables become permanent
 *    - When you "rollback", temp tables are deleted
 * 
 * 3. TABLE REFERENCES:
 *    - Tables can live in different places (SQLite file, memory, browser storage)
 *    - TableRef is a "pointer" that says "where is this table and what's it called?"
 *    - This abstraction means nodes don't care WHERE data lives
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * SessionId - Unique identifier for a workflow execution session
 * 
 * A session represents a single workflow execution with its own temporary tables.
 * Think of it like a database transaction, but for an entire workflow.
 */
export type SessionId = string;

/**
 * TableRef - Reference to a table (could be in SQLite, memory, or a file)
 * 
 * WHY WE NEED THIS:
 * In a workflow, Node A might output "filtered_points" as a temp table in memory,
 * and Node B needs to read it. TableRef tells Node B "here's where to find the data".
 * 
 * The 'kind' field determines where the data lives:
 * - 'persistent': Committed to the database permanently
 * - 'temporary': In-memory or temp table, will be deleted unless committed
 * - 'file': On disk (like a .gpkg or .parquet file)
 */
export type TableRef = 
  | { kind: 'persistent'; name: string }
  | { kind: 'temporary'; name: string; sessionId: SessionId }
  | { kind: 'file'; path: string };

/**
 * Schema - Describes the structure of a table (column names and types)
 * 
 * Example:
 * {
 *   columns: [
 *     { name: 'id', type: 'integer' },
 *     { name: 'geometry', type: 'geometry' },
 *     { name: 'status', type: 'string' }
 *   ]
 * }
 */
export interface Schema {
  columns: Array<{
    name: string;
    type: 'integer' | 'float' | 'string' | 'boolean' | 'geometry' | 'date';
  }>;
}

/**
 * TableInfo - Metadata about a table
 */
export interface TableInfo {
  name: string;
  schema: Schema;
  rowCount: number;
  isTemporary: boolean;
}

/**
 * OperationResult - What gets returned after executing an operation
 * 
 * DESIGN NOTE:
 * We return a TableRef (not the actual data!) because:
 * - Data might be huge (millions of rows)
 * - Next node only needs to know "where is the result table?"
 * - Actual data stays in the engine (backend or WASM) until needed
 */
export interface OperationResult {
  success: boolean;
  outputTable: TableRef;
  rowCount?: number;
  message?: string;
  error?: string;
}

// ============================================================================
// MAIN ENGINE INTERFACE
// ============================================================================

/**
 * IDataEngine - The core abstraction for all data operations
 * 
 * THIS IS THE KEY TO OUR ARCHITECTURE:
 * Any class that implements this interface can be used as the "engine" for our app.
 * We can swap between RemoteDataEngine (FastAPI) and WasmDataEngine (browser)
 * without changing ANY component code.
 * 
 * ANALOGY FOR BEGINNERS:
 * Think of this like a TV remote interface:
 * - The interface says: "you must have play(), pause(), volume()"
 * - Sony TV and Samsung TV both implement this interface
 * - Your remote works with both, even though they work differently internally
 * 
 * Similarly:
 * - RemoteDataEngine sends HTTP requests to Python backend
 * - WasmDataEngine runs SQL in the browser with DuckDB
 * - But both support createSession(), executeOperation(), etc.
 */
export interface IDataEngine {
  /**
   * Initialize the engine (load WASM, connect to server, etc.)
   * 
   * WHY ASYNC:
   * - RemoteEngine: might need to check server health
   * - WasmEngine: needs to load .wasm files (heavy!)
   */
  init?(): Promise<void>;

  // -------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // -------------------------------------------------------------------------

  /**
   * Create a new workflow execution session
   * 
   * Returns a SessionId that you'll use for all subsequent operations.
   * 
   * WHAT HAPPENS:
   * - Remote: POST /api/sessions -> backend creates in-memory session
   * - WASM: Create an in-memory workspace in DuckDB
   */
  createSession(): Promise<SessionId>;

  /**
   * Destroy a session and clean up all temporary tables
   * 
   * IMPORTANT:
   * Always call this when workflow is done, or you'll leak memory!
   */
  destroySession(sessionId: SessionId): Promise<void>;

  // -------------------------------------------------------------------------
  // TABLE INTROSPECTION (querying what tables exist)
  // -------------------------------------------------------------------------

  /**
   * List all tables (persistent and temporary)
   * 
   * USE CASE:
   * - Show user what datasets are available
   * - Debug: "what temp tables exist in this session?"
   */
  listTables(sessionId: SessionId, includeTemporary?: boolean): Promise<TableInfo[]>;

  /**
   * Check if a table exists
   */
  tableExists(sessionId: SessionId, tableName: string): Promise<boolean>;

  /**
   * Get the schema (column names and types) of a table
   * 
   * USE CASE:
   * - User picks a dataset, we show them available columns for filtering
   */
  getTableSchema(sessionId: SessionId, tableName: string): Promise<Schema>;

  // -------------------------------------------------------------------------
  // CORE OPERATION EXECUTION
  // -------------------------------------------------------------------------

  /**
   * Execute a data operation (filter, buffer, join, etc.)
   * 
   * THIS IS WHERE THE MAGIC HAPPENS:
   * - You pass an Operation object (defined in operations.ts)
   * - Engine decides how to execute it (SQL query, Python function, etc.)
   * - Returns a TableRef pointing to the result
   * 
   * EXAMPLE FLOW:
   * 1. User runs a "filter" node
   * 2. We create a FilterOperation object: { type: 'filter', input: ..., column: 'status', values: ['active'] }
   * 3. Call executeOperation(sessionId, filterOp)
   * 4. Engine creates temp table with filtered results
   * 5. Returns: { success: true, outputTable: { kind: 'temporary', name: 'temp_abc123', sessionId } }
   * 6. Next node uses this TableRef as its input
   */
  executeOperation(
    sessionId: SessionId,
    operation: Operation
  ): Promise<OperationResult>;

  // -------------------------------------------------------------------------
  // MATERIALIZATION (temp -> permanent)
  // -------------------------------------------------------------------------

  /**
   * Commit a temporary table to make it permanent
   * 
   * WHY WE NEED THIS:
   * - During workflow execution, we create temp tables
   * - If user is happy with results, they "commit the workflow"
   * - This saves temp tables to the database permanently
   * 
   * WHAT HAPPENS:
   * - Remote: Backend renames temp table to final name in SQLite
   * - WASM: Export temp table to IndexedDB as Parquet file
   */
  commitTable(
    sessionId: SessionId,
    tempTableName: string,
    finalTableName: string
  ): Promise<void>;

  /**
   * Rollback/abort a session (delete all temp tables)
   * 
   * USE CASE:
   * - User runs workflow, doesn't like results -> rollback
   * - Error during execution -> automatic rollback
   */
  rollbackSession(sessionId: SessionId): Promise<void>;
}

// ============================================================================
// OPERATION TYPE (imported from operations.ts)
// ============================================================================

/**
 * Operation - A data transformation command
 * 
 * We'll define the full union type in operations.ts
 * This is just a placeholder for the import
 */
export type Operation = any; // Will be properly typed in operations.ts
