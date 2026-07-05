# Frontend Core (public/)

React 18 SPA. Entry `public/main.jsx` mounts `app.jsx` inside nested context providers:
`ConfigProvider → UIProvider → ConversionProvider → MergeProvider → UndoProvider`.

## State (public/contexts/)
- `ConfigContext` — parsed/normalized input config + edits.
- `ConversionContext` — conversion run + SRX output state.
- `MergeContext` — merging/diffing configs.
- `UIContext` — UI/view state, theme.
- `UndoContext` — undo/redo stack (paired with `useUndoRedo`).
Add new global state as a new context here, not via prop-drilling.

## Hooks (public/hooks/)
`useConfig`, `useConversion`, `useLLM`, `useProject`, `usePush`, `useDay2Ops`, `useSectionAcceptance`, `useKeyboardShortcuts`, `useResizablePanel`, `useUndoRedo`. These are the bridge from components to engine (`src/`) + contexts.

## Components (public/components/)
~45 components. Layout under `components/layout/` (`TopBar`, `StatusBar`, `ContentRouter`, `RightPanel`) — routing is custom via `ContentRouter`, no router lib. Domain editors: `ZoneEditor`, `NATEditor`, `VPNEditor`, `RoutingEditor`, `HAEditor`, `QoSEditor`, etc. LLM UI: `LLMSettings`, `ModelSelector`, `GreenfieldChat`, `ReviewChatPanel`, `LLMRiskDisclaimer`.

## Rules
- Import paths need explicit `.jsx`/`.js` extension.
- `localStorage` JSON reads via `safeJsonParse` only (see `mem:conventions`).
- Color semantics are strict — see `mem:conventions` before styling.
- Components consume the engine through hooks/contexts; don't call engine internals directly from deep components.
