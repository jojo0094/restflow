# Undockable Poppable Plan

Goal: Make `Poppable-1` and `Poppable-2` undockable dialogs that can float, be moved, resized, and snapped back into place.

High level
- Each poppable is renderable in two modes: docked (in-layout) and undocked (floating dialog).
- Undocked dialogs render into an overlay using a portal, are draggable, and snap back to their dock slot when released nearby.
- Provide visual affordances (header, close/undock button, snap highlight) and pointer/touch support.

Milestones
1. Create reusable `Poppable` component that supports dock/undock and basic dragging. (in-progress)
2. Integrate `Poppable` into `Layout.tsx` replacing `Poppable-1` and `Poppable-2`. (not-started)
3. Add snap/capture visual and animation + configurable thresholds. (not-started)
4. Add resizing handles for undocked dialogs and keyboard accessibility. (not-started)
5. Persist state (docked/undocked, position, size) to localStorage. (not-started)

Notes
- Browser security prevents moving windows outside the browser. We can allow dialogs to be positioned partially offscreen but not outside the browser window.
- We'll use pointer events and requestAnimationFrame for smooth dragging when necessary.

I'll update this file as I complete each milestone.
