# Status + Monitoring Dashboard (MERN Monorepo)

Production-ready monorepo for public service status and protected infrastructure monitoring.

## Folder structure

```
status/
  client/
    src/
      api/
      components/
      pages/
      utils/
    public/
  middleware/
    authMiddleware.js
  models/
    Status.js
    User.js
  routes/
    adminRoutes.js
    authRoutes.js
    statusRoutes.js
  services/
    healthService.js
    monitorService.js
    securityService.js
    userService.js
  .env.example
  package.json
  server.js
```

## Features

- Public status page at `/`
- Admin login at `/login` using JWT
- Protected admin dashboard at `/admin`
- 1-minute cron monitoring for:
  - https://prasadacademic.in
  - https://easeexit.prasadacademic.in
  - https://elective.prasadacademic.in
- MongoDB persistence for status history
- Server health API:
  - CPU load
  - Memory usage
  - Uptime
  - Disk usage
- Security API (Linux hosts):
  - Recent logins from `last -a`
  - Failed SSH attempts from auth log pattern
  - Top processes by CPU from `ps aux --sort=-%cpu`

## Environment

1. Copy `.env.example` to `.env`
2. Update values:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/status_dashboard
JWT_SECRET=change-this-to-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
```

## Development

From repository root:

```bash
npm install
npm install --prefix client
npm run dev
```

Runtime behavior:

- React client: http://localhost:3000
- Backend API: http://localhost:5000
- Client API calls: `/api/...`

## Production

Build and run from root:

```bash
npm run build
NODE_ENV=production npm start
```

In production, backend serves `client/build` and keeps `/api/*` for APIs.

## API endpoints

Public:

- `GET /api/status`

Auth:

- `POST /api/auth/login`

Admin (JWT required):

- `GET /api/admin/health`
- `GET /api/admin/security`

## PM2 deployment

```bash
npm run build
pm2 start server.js --name status-dashboard --env production
pm2 save
pm2 startup
```

## Nginx reverse proxy example

```nginx
server {
    listen 80;
    server_name status.prasadacademic.in;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```
