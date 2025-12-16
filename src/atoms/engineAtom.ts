/**
 * Engine Ready Atom - Track when the data engine is initialized
 * 
 * WHY WE NEED THIS:
 * React functional components' useEffect hooks run in parallel.
 * App.tsx initializes the engine, but child components don't know when it's ready.
 * This atom allows any component to check if the engine is ready before using it.
 * 
 * ALTERNATIVE APPROACHES:
 * 1. Pass engineReady as a prop (prop drilling - messy)
 * 2. Use React Context (more boilerplate than Jotai)
 * 3. Make initEngine() block rendering (bad UX - no loading screen)
 * 
 * Jotai is the cleanest solution for this global state.
 */

import { atom } from 'jotai';

/**
 * Engine ready state
 * 
 * false = Engine not yet initialized (or failed)
 * true = Engine ready to use
 * 
 * Usage:
 * ```tsx
 * const [engineReady] = useAtom(engineReadyAtom);
 * 
 * useEffect(() => {
 *   if (!engineReady) return; // Wait for engine
 *   
 *   createWorkflowSession().then(setSessionId);
 * }, [engineReady]);
 * ```
 */
export const engineReadyAtom = atom<boolean>(false);
