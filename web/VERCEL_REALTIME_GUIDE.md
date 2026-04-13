# V2X Realtime Setup (Vercel-Only, No Firebase)

This app now uses a Vercel-first realtime architecture with client listeners and optional Socket.io fallback.

## 1) Realtime schema

Use this structure in your Vercel-backed data store (KV/Postgres/Edge store):

- `/vehicles/{id}`
  - `id`, `role`, `label`, `vehicleType`
  - `latitude`, `longitude`
  - `kalmanLatitude`, `kalmanLongitude`
  - `speed`, `heading`, `accuracy`
  - `broadcastEnabled`, `connectionStatus`, `updatedAt`
- `/emergency`
  - `active`, `vehicleType`, `kalmanEnabled`, `lastUpdatedAt`
- `/signals`
  - `mode` (`normal`/`override`)
  - `north`, `south`, `east`, `west`
  - `overrideDirection`, `evDistanceMeters`, `source`
- `/logs`
  - append-only event entries with `id`, `timestamp`, `level`, `source`, `message`

## 2) Realtime listeners

The frontend listener stack is:

1. **BroadcastChannel** for low-latency multi-tab sync
2. **localStorage sync event** fallback
3. **Server listener stream** via `EventSource` if `NEXT_PUBLIC_VERCEL_LISTENER_URL` is set
4. **Socket.io fallback** if `NEXT_PUBLIC_SOCKET_URL` is set

## 3) Required env vars (optional but recommended)

- `NEXT_PUBLIC_VERCEL_SYNC_ENDPOINT`  
  `POST` endpoint that receives the snapshot every update tick
- `NEXT_PUBLIC_VERCEL_LISTENER_URL`  
  Server-Sent Events stream endpoint for real-time fanout to clients
- `NEXT_PUBLIC_SOCKET_URL`  
  Socket.io server URL for websocket fallback

## 4) Module behavior implemented

- Emergency node pushes GPS data every 1 second
- Kalman filter can be toggled ON/OFF and shows raw vs smoothed coordinates
- Vincenty distance is used for EV-to-vehicle and EV-to-signal distance checks
- V2V warning threshold: **25m**
- V2I override threshold: **50m**
- Signal override direction is derived from EV heading
- Civilian warning triggers an audio siren alert
- Admin map shows all nodes with OSM + walking street layer and radius circles

## 5) Future upgrades ready

- 3D map (Mapbox GL)
- AI route optimization
- Full server authoritative state with Vercel Functions + durable storage
