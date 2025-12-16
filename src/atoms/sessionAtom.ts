/**
 * Session Atom - Global state for workflow session
 * 
 * WHY WE NEED THIS:
 * When building a workflow, we need a "workspace" to store intermediate results.
 * This is like having a shopping cart while you shop - you don't checkout until you're done.
 * 
 * HOW IT WORKS:
 * - Session is created when WorkflowPanel mounts
 * - SessionId is stored in this atom (accessible by all components)
 * - TaskNode components use this sessionId to execute operations
 * - Temporary tables are tracked within the session
 * - When you commit, temp tables become permanent
 * - When you rollback or close, temp tables are deleted
 * 
 * ANALOGY:
 * Session = Transaction in a database
 * - You make changes in isolation
 * - You can commit (save) or rollback (discard)
 * - Other users don't see your work-in-progress
 */

import { atom } from 'jotai';
import type { SessionId } from '../lib/engine/types';

/**
 * Current workflow session ID.
 * 
 * null = No active session
 * string = Active session with temp tables in backend
 * 
 * Usage:
 * ```tsx
 * const [sessionId, setSessionId] = useAtom(sessionAtom);
 * 
 * // Create session on mount
 * useEffect(() => {
 *   createWorkflowSession().then(setSessionId);
 * }, []);
 * ```
 */
export const sessionAtom = atom<SessionId | null>(null);
