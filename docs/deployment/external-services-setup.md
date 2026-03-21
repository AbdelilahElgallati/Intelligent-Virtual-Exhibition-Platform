# IVEP External Services Setup Guide

## MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create DB user with readWrite permissions for your DB.
3. Network access:
   - Add your Hetzner VPS public IP
   - Keep access restricted to known IPs only
4. Get connection string and set:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
```

## Redis

### Option A: Managed Redis (recommended)

Use provider URL directly:

```env
REDIS_URL=redis://<user>:<password>@<host>:<port>/0
```

### Option B: Local Redis (docker-compose)

Already included in compose. Use:

```env
REDIS_URL=redis://redis:6379/0
```

## Cloudflare R2

1. Create R2 bucket.
2. Generate Access Key and Secret Access Key.
3. Collect endpoint URL from R2 dashboard.

Set backend env:

```env
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=<bucket>
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
```

## LiveKit Cloud

1. Create LiveKit Cloud project.
2. Get API Key and API Secret.
3. Get server URL and websocket URL.

Backend env:

```env
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<api-secret>
LIVEKIT_URL=<livekit-server-url>
LIVEKIT_WS_URL=<livekit-websocket-url>
```

Frontend env:

```env
NEXT_PUBLIC_LIVEKIT_URL=<public-livekit-url>
```

## Stripe

1. Get keys from Stripe Dashboard:
   - Secret key (backend)
   - Publishable key (frontend)
2. Configure webhook endpoint:
   - `https://api.yourdomain.com/api/v1/marketplace/webhook/stripe`
3. Copy webhook signing secret.

Backend env:

```env
STRIPE_SECRET_KEY=<secret>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
```

Frontend env:

```env
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=<publishable-key>
```

## Security checklist

- Never commit real .env files.
- Rotate keys if exposed.
- Restrict Atlas network access to VPS IP.
- Use least-privilege access for all service accounts.
- Enable HTTPS before going live.
