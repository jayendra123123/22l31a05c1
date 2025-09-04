
# URL Shortener Microservice (Backend)

## Run
```bash
cd backend
npm install
npm run start
```
It starts at `http://localhost:8080`.

## Endpoints
- `POST /shorturls` — create a short URL
- `GET /shorturls` — list all
- `GET /shorturls/:code` — get stats
- `GET /:code` — redirect (records click)
