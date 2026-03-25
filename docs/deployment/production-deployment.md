# IVEP Production Deployment Guide

This guide deploys:

- Backend on Hetzner VPS (Docker + Compose + NGINX)
- Frontend on Vercel
- MongoDB Atlas, Redis, Cloudflare R2, Daily.co, Stripe

## 1. Prerequisites

- Ubuntu VPS on Hetzner
- Domain names (example):
  - `api.yourdomain.com` for backend
  - `app.yourdomain.com` for frontend
- SSH access with sudo

Install base packages on VPS:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg lsb-release
```

Install Docker and Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 2. Clone project on VPS

```bash
git clone https://github.com/AbdelilahElgallati/Intelligent-Virtual-Exhibition-Platform.git
cd Intelligent-Virtual-Exhibition-Platform
```

## 3. Prepare backend environment

Create backend env file from template:

```bash
cp backend/.env.example backend/.env
```

Edit values:

```bash
nano backend/.env
```

Minimum production values:

- `APP_ENV=production`
- `ENV=prod`
- `DEBUG=false`
- `MONGO_URI=<Atlas connection string>`
- `REDIS_URL=<managed redis url or redis://redis:6379/0>`
- `JWT_SECRET_KEY=<strong random secret>`
- `FRONTEND_URL=https://app.yourdomain.com`
- `CORS_ORIGINS=https://app.yourdomain.com`
- Stripe keys
- Daily keys
- R2 keys

## 4. Configure NGINX domain

Edit NGINX config to set your backend domain:

```bash
nano deploy/nginx/nginx.conf
```

Set `server_name` to your API domain, example:

```nginx
server_name api.yourdomain.com;
```

## 5. Build and start containers

```bash
docker compose pull
docker compose build backend
docker compose up -d
docker compose ps
```

Check backend health:

```bash
curl http://127.0.0.1/health
curl http://127.0.0.1/api/v1/openapi.json
```

## 6. HTTPS with Let's Encrypt (certbot --nginx)

If you want to use `certbot --nginx`, install host NGINX + Certbot plugin and use the same config path on host.

Install certbot and nginx plugin:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Run certificate issuance:

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Auto-renew test:

```bash
sudo certbot renew --dry-run
```

If you keep NGINX inside Docker only, use a webroot/containerized certbot flow instead of `--nginx`.

## 7. Optional: run compose on reboot with systemd

Create service file:

```bash
sudo tee /etc/systemd/system/ivep-compose.service >/dev/null <<'EOF'
[Unit]
Description=IVEP Docker Compose Stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
WorkingDirectory=/home/<your-user>/Intelligent-Virtual-Exhibition-Platform
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
```

Enable service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ivep-compose.service
sudo systemctl start ivep-compose.service
```

## 8. Deploy frontend on Vercel

1. Import GitHub repository in Vercel.
2. Set root directory to `frontend`.
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
   - `NEXT_PUBLIC_STRIPE_PUBLIC_KEY=<stripe publishable key>`
  - `NEXT_PUBLIC_DAILY_DOMAIN=<yourapp.daily.co>`
4. Deploy.
5. Set DNS for `app.yourdomain.com` to Vercel.

## 9. Final smoke tests

Backend:

```bash
curl -I https://api.yourdomain.com/health
curl -I https://api.yourdomain.com/api/v1/openapi.json
```

Frontend:

- Open `https://app.yourdomain.com`
- Confirm API calls target `https://api.yourdomain.com/api/v1/...`
- Test auth flow, event flow, marketplace checkout, webhook path

## 10. Stripe webhook endpoint

Configure in Stripe dashboard:

- URL: `https://api.yourdomain.com/api/v1/marketplace/webhook/stripe`
- Events: `checkout.session.completed` (and any additional required events)

Store secret in backend env:

- `STRIPE_WEBHOOK_SECRET=...`
