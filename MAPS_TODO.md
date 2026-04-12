# Maps TODO (V2X Connect)

This file tracks map-specific implementation tasks for the active Next.js app in `/web`.

## Current status
- Functional map tabs are available on module pages.
- Street and satellite layer switching is enabled.
- GPS data simulation runs for all 4 units with optional browser geolocation for emergency unit.

## TODO
- [ ] Replace iframe map rendering with a first-party map SDK integration (Leaflet/MapLibre) for richer controls.
- [ ] Add marker clustering and route history polylines for emergency and vehicle units.
- [ ] Add geofence overlay and intersection alert visualization.
- [ ] Add map source selector with provider fallbacks and health checks.
- [ ] Add configurable refresh rate and pause/resume controls for dashboard-map sync.
- [ ] Add integration tests for map layer switching and marker update behavior.
- [ ] Add performance instrumentation for frame-time and memory tracking.
- [ ] Add map error boundary UI for tile/network failures.

## Validation checklist
- [ ] Map renders on `/control`, `/emergency`, `/signal`, `/vehicle1`, `/vehicle2`, `/admin`, `/admin-preview`.
- [ ] Layer switching works without route reload.
- [ ] No console errors during 10-minute live run.
- [ ] Dashboard metrics and map position stay synchronized.
