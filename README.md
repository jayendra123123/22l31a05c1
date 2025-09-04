
# Full-Stack URL Shortener (Assignment Starter)

This bundle includes:
- **backend/** Node.js microservice (Express + SQLite). Uses a **custom Logging Middleware** (no console).
- **frontend/** React + Material UI app (runs on **http://localhost:3000**).

## Quick Start

### 1) Backend
```bash
cd backend
npm install
npm start
```
Service: http://localhost:8080

### 2) Frontend
Open a new terminal:
```bash
cd frontend
npm install
npm start
```
App: http://localhost:3000

## API Overview
- `POST /shorturls` — body: `{ url, validity?, shortcode? }` → `201 { shortLink, expiry }`
- `GET /shorturls` — list all short urls with summary
- `GET /shorturls/:code` — detailed stats for a shortcode
- `GET /:code` — redirects to the long URL and records click analytics

## Notes
- Default validity is **30 minutes** when omitted.
- Custom shortcode must be unique (alphanumeric, `_` or `-`, length 3–32).
- Analytics capture timestamp, referrer, and coarse geo (country/region/city) from IP using `geoip-lite`.
- All logs go to `backend/logs/app.log` in JSON Lines format.
