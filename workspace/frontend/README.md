# FMS Dashboard (Vite + React + Tailwind)

- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

By default, API calls hit `/fms/api/v0/*`. During local dev, Vite proxies this to `http://localhost:3000` (configurable via `VITE_PROXY_TARGET`).

UI mocks available under `public/ui-mocks`:
- `dashboard-wire1.svg`
- `journals-wire1.svg`
