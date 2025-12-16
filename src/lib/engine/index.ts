/**
 * ENGINE MODULE - Public Exports
 * 
 * This is the "barrel file" - it re-exports everything from the engine module.
 * Components import from here instead of individual files.
 * 
 * WHY THIS PATTERN:
 * Instead of:
 *   import { IDataEngine } from '../engine/types';
 *   import { Operation } from '../engine/operations';
 *   import { RemoteDataEngine } from '../engine/remote-engine';
 * 
 * We can do:
 *   import { IDataEngine, Operation, RemoteDataEngine } from '../engine';
 * 
 * Benefits:
 * - Cleaner imports
 * - Single entry point (easier to refactor internal structure)
 * - Clear public API
 */

// Types
export type {
  IDataEngine,
  SessionId,
  TableRef,
  Schema,
  TableInfo,
  OperationResult
} from './types';

// Operations
export type {
  Operation,
  IngestOperation,
  FilterOperation,
  BufferOperation,
  JoinOperation,
  AggregateOperation,
  ExportOperation,
  Filter
} from './operations';

export {
  createFilter,
  createTempTableRef,
  createPersistentTableRef
} from './operations';

// Engine implementations
export { RemoteDataEngine } from './remote-engine';

// Future: export { WasmDataEngine } from './wasm-engine';
