/**
 * OPERATIONS - Data Transformation Commands
 * 
 * This file defines all the operations our workflow nodes can perform.
 * Each operation is a plain JavaScript object (Command Pattern).
 * 
 * WHY PLAIN OBJECTS (not functions)?
 * 1. Serializable: Can be sent over network or saved to disk
 * 2. Inspectable: Can log, debug, or show user what's happening
 * 3. Composable: Can chain operations together
 * 4. Engine-agnostic: Same operation works with FastAPI or WASM
 * 
 * BEGINNERS: Command Pattern Analogy
 * ====================================
 * Think of ordering food at a restaurant:
 * - You don't go to the kitchen and cook (calling functions directly)
 * - You write an order slip: "Burger, no pickles, extra cheese"
 * - Kitchen decides HOW to make it (different chefs = different engines)
 * 
 * Similarly:
 * - Node creates an operation object: { type: 'filter', column: 'status', values: ['active'] }
 * - Engine decides HOW to execute: SQL WHERE clause, or Python dataframe filter
 */

import type { TableRef, SessionId } from './types';

// ============================================================================
// FILTER DEFINITIONS (reusable across operations)
// ============================================================================

/**
 * Filter - Describes a single filter condition
 * 
 * EXAMPLE:
 * { column: 'status', operator: 'equals', value: 'active' }
 * -> Translates to SQL: WHERE status = 'active'
 * 
 * { column: 'population', operator: 'greater_than', value: 10000 }
 * -> Translates to SQL: WHERE population > 10000
 */
export interface Filter {
  column: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains';
  value: any; // Could be string, number, array, etc.
}

// ============================================================================
// OPERATION DEFINITIONS
// ============================================================================

/**
 * IngestOperation - Load data from a source into the workspace
 * 
 * USE CASES:
 * - Load a dataset from the server's sample data folder
 * - Load a file the user uploaded
 * - Apply filters during ingestion (avoid loading unnecessary data)
 * 
 * EXAMPLE:
 * {
 *   type: 'ingest',
 *   source: { kind: 'dataset', name: 'water_points' },
 *   filters: [{ column: 'status', operator: 'equals', value: 'active' }],
 *   destination: 'my_filtered_points'  // Optional: custom name for output table
 * }
 */
export interface IngestOperation {
  type: 'ingest';
  
  /**
   * Where to load data from
   * - 'dataset': Server-side registered dataset (e.g., water_points)
   * - 'file': User uploaded file (path or file handle)
   */
  source: 
    | { kind: 'dataset'; name: string }
    | { kind: 'file'; path: string };
  
  /**
   * Optional filters to apply during ingestion
   * (More efficient than loading all data then filtering)
   */
  filters?: Filter[];
  
  /**
   * Optional custom name for the output table
   * If not provided, engine generates a temp name like "temp_abc123"
   */
  destination?: string;
}

/**
 * FilterOperation - Filter rows based on column values
 * 
 * EXAMPLE:
 * {
 *   type: 'filter',
 *   input: { kind: 'temporary', name: 'temp_abc123', sessionId },
 *   filters: [
 *     { column: 'type', operator: 'in', value: ['residential', 'commercial'] },
 *     { column: 'area', operator: 'greater_than', value: 1000 }
 *   ]
 * }
 * 
 * Translates to SQL:
 * SELECT * FROM temp_abc123
 * WHERE type IN ('residential', 'commercial')
 *   AND area > 1000
 */
export interface FilterOperation {
  type: 'filter';
  input: TableRef;
  filters: Filter[];
  destination?: string;
}

/**
 * BufferOperation - Create a buffer zone around geometries
 * 
 * SPATIAL OPERATION EXAMPLE:
 * {
 *   type: 'buffer',
 *   input: { kind: 'persistent', name: 'water_points' },
 *   distance: 100,  // meters
 *   destination: 'water_point_buffers'
 * }
 * 
 * Translates to SQL (PostGIS/SpatiaLite):
 * SELECT ST_Buffer(geometry, 100) as geometry, *
 * FROM water_points
 */
export interface BufferOperation {
  type: 'buffer';
  input: TableRef;
  distance: number;  // Buffer distance in map units
  destination?: string;
}

/**
 * JoinOperation - Spatial or attribute join between two tables
 * 
 * EXAMPLES:
 * 
 * Attribute Join (like SQL JOIN):
 * {
 *   type: 'join',
 *   left: { kind: 'temporary', name: 'parcels', sessionId },
 *   right: { kind: 'persistent', name: 'owners' },
 *   joinType: 'attribute',
 *   on: { leftColumn: 'owner_id', rightColumn: 'id' }
 * }
 * 
 * Spatial Join (find intersecting features):
 * {
 *   type: 'join',
 *   left: { kind: 'temporary', name: 'points', sessionId },
 *   right: { kind: 'persistent', name: 'polygons' },
 *   joinType: 'spatial',
 *   spatialPredicate: 'within'  // points within polygons
 * }
 */
export interface JoinOperation {
  type: 'join';
  left: TableRef;
  right: TableRef;
  joinType: 'attribute' | 'spatial';
  
  // For attribute joins
  on?: {
    leftColumn: string;
    rightColumn: string;
  };
  
  // For spatial joins
  spatialPredicate?: 'intersects' | 'within' | 'contains' | 'overlaps';
  
  destination?: string;
}

/**
 * AggregateOperation - Group by and aggregate (like SQL GROUP BY)
 * 
 * EXAMPLE:
 * Count water points by status:
 * {
 *   type: 'aggregate',
 *   input: { kind: 'persistent', name: 'water_points' },
 *   groupBy: ['status'],
 *   aggregations: [
 *     { column: 'id', function: 'count', alias: 'count' },
 *     { column: 'flow_rate', function: 'avg', alias: 'avg_flow' }
 *   ]
 * }
 * 
 * Translates to SQL:
 * SELECT status, 
 *        COUNT(id) as count,
 *        AVG(flow_rate) as avg_flow
 * FROM water_points
 * GROUP BY status
 */
export interface AggregateOperation {
  type: 'aggregate';
  input: TableRef;
  groupBy: string[];  // Column names to group by
  aggregations: Array<{
    column: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max';
    alias: string;  // Output column name
  }>;
  destination?: string;
}

/**
 * ExportOperation - Export results to a file format
 * 
 * EXAMPLE:
 * {
 *   type: 'export',
 *   input: { kind: 'temporary', name: 'final_result', sessionId },
 *   format: 'gpkg',
 *   path: 'output/results.gpkg'
 * }
 */
export interface ExportOperation {
  type: 'export';
  input: TableRef;
  format: 'gpkg' | 'geojson' | 'parquet' | 'csv';
  path: string;  // Output file path
}

// ============================================================================
// UNION TYPE: All possible operations
// ============================================================================

/**
 * Operation - Union of all operation types
 * 
 * TYPESCRIPT TIP:
 * This is a "discriminated union" - TypeScript knows which operation it is
 * based on the 'type' field.
 * 
 * Example:
 * ```
 * function executeOperation(op: Operation) {
 *   if (op.type === 'buffer') {
 *     // TypeScript knows op is BufferOperation here
 *     console.log(op.distance);  // ✓ TypeScript allows this
 *   }
 * }
 * ```
 */
export type Operation =
  | IngestOperation
  | FilterOperation
  | BufferOperation
  | JoinOperation
  | AggregateOperation
  | ExportOperation;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a filter object with type safety
 * 
 * USAGE:
 * const statusFilter = createFilter('status', 'equals', 'active');
 * const populationFilter = createFilter('population', 'greater_than', 10000);
 */
export function createFilter(
  column: string,
  operator: Filter['operator'],
  value: any
): Filter {
  return { column, operator, value };
}

/**
 * Helper to create a temporary TableRef
 * 
 * USAGE:
 * const tempTable = createTempTableRef('temp_abc123', sessionId);
 */
export function createTempTableRef(name: string, sessionId: SessionId): TableRef {
  return { kind: 'temporary', name, sessionId };
}

/**
 * Helper to create a persistent TableRef
 */
export function createPersistentTableRef(name: string): TableRef {
  return { kind: 'persistent', name };
}
