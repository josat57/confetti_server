# Deploying to Render

`render.yaml` (repo root) creates the app on Render's free tier:

| Service | Type | URL |
|---|---|---|
| `confetti-api` | Node web service (this repo, `apidev`) | https://confetti-api.onrender.com |
| `confetti-ai` | Python web service, Docker (`src/python`) | https://confetti-ai.onrender.com |
| `confetti-web` | Next.js web service (`josat57/confetti_`, `develop`) | https://confetti-web.onrender.com |
| Redis | Your existing Key Value instance (free tier allows one per workspace) | — |

MongoDB isn't offered by Render — use MongoDB Atlas.

## 1. MongoDB Atlas

1. Create a free M0 cluster. Pick AWS **Oregon (us-west-2)** if available — the Render services run in Oregon, and every database query crosses that distance.
2. Database Access: add a user with read/write access.
3. Network Access: allow `0.0.0.0/0`. Render free services have no fixed outbound IPs.
4. Copy the connection string and **put the database name in the path**:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/confetti?retryWrites=true&w=majority`
   Without `/confetti`, the API and the AI service would use different databases.

## 2. Redis (existing Key Value instance)

The free tier allows one Key Value instance per workspace, so the Blueprint uses the one you already have instead of creating its own.

1. Open the existing Key Value instance in the dashboard and check its **region**. It must be **Oregon** (the region in `render.yaml`) for the internal URL to work. If it's elsewhere, change every `region: oregon` in `render.yaml` to that region before creating the Blueprint — the region can't be changed after a service is created.
2. Copy its **Internal Key Value URL** (e.g. `redis://red-xxxxxxxx:6379`) and add a database number so Confetti's keys don't mix with the other project's: `redis://red-xxxxxxxx:6379/1`. The other project normally uses database `0`.

## 3. Push the code

Render deploys from GitHub: push this repo (with `render.yaml`) to `apidev`, and the frontend to `develop`. Give Render access to both repositories when connecting GitHub.

## 4. Create the Blueprint

Render Dashboard → **New → Blueprint** → choose `confetti_server`, branch `apidev`. Render shows the services and prompts for these values:

| Variable | Service | What to enter |
|---|---|---|
| `MONGODB_URI` | api, ai | Atlas string from step 1 (same value both times) |
| `REDIS_URL` | api, ai | Internal URL with database number from step 2 (same value both times) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | api | First admin account, created on first start |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` | api | Mail provider (port 587, STARTTLS). `SMTP_USER` must be an email address |
| `PAYSTACK_*`, `FLUTTERWAVE_*` | api | Payment keys (test keys are fine to start) |
| `CLOUDINARY_*` | api | Image/document storage |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | ai | At least one; the other can be any placeholder |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | web | Public keys used in the browser |

Secrets such as the JWT keys, `PYTHON_API_KEY` and the encryption keys are generated automatically. Don't change `SECRETS_ENCRYPTION_KEY` or `ENCRYPTION_KEY` later — data encrypted with them would become unreadable.

## 5. After the first deploy

1. **Check the URLs.** If Render gave any service a different address (names are global, so it may add a suffix), update `FRONTEND_URL` and `PYTHON_API_URL` on `confetti-api` and `NEXT_PUBLIC_API_URL` on `confetti-web`, then redeploy both. `NEXT_PUBLIC_*` values are baked in at build time, so the web service must be rebuilt.
2. **Health checks:**
   - https://confetti-api.onrender.com/health → 200
   - https://confetti-ai.onrender.com/health/ai → `healthy`, or `degraded` if an AI key or MongoDB is missing
3. **Payment webhooks** — set these in the provider dashboards:
   - Paystack: `https://confetti-api.onrender.com/api/v1/webhooks/payment/paystack`
   - Flutterwave: `https://confetti-api.onrender.com/api/v1/webhooks/payment/flutterwave`

   Payment redirect/callback URLs use the API's Render URL automatically. Don't set `PUBLIC_NGROK_URL` on Render.
4. **Admin:** sign in at https://confetti-web.onrender.com/admin/login with the super admin from step 4.

## Free tier: what to expect

- Each service sleeps after 15 minutes without traffic; the next request takes about a minute. While the API sleeps its background jobs (email retry queue, reminders) pause, and payment webhooks may time out — Paystack and Flutterwave retry them.
- Free instance hours are shared across the workspace (750/month). Sleeping services don't use them.
- The AI service runs on 0.1 CPU, so AI requests are slow.
- Disks are wiped on every deploy: database backups are disabled, and the email retry queue doesn't survive restarts.
- The free Key Value instance (shared with your other project) has 25 MB and no persistence; guest plans and caches are lost on restart. Saved plans live in MongoDB.
- If the frontend build runs out of memory, upgrade `confetti-web` to Starter.

## Moving to paid plans

In `render.yaml`, then sync the Blueprint:

1. `plan: starter` (or higher) on the services — no sleeping, more CPU/memory.
2. Make the AI service private: change `confetti-ai` to `type: pserv`, and on `confetti-api` replace the `PYTHON_API_URL` value with
   ```yaml
   - key: PYTHON_API_URL
     value: http://confetti-ai:5600
   ```
   (the internal hostname is shown on the service's page in the dashboard).
3. Backups: add a disk to `confetti-api` and turn backups on:
   ```yaml
   disk:
     name: confetti-data
     mountPath: /opt/render/project/src/data
     sizeGB: 5
   ```
   and set `BACKUP_ENABLED` to `"true"`.
4. Redis: upgrade the Key Value instance to a paid plan for persistence and more memory, or give Confetti its own instance by adding a `keyvalue` service to `render.yaml` and pointing `REDIS_URL` at it with `fromService` (`property: connectionString`).
5. Custom domains (e.g. `app.example.com`, `api.example.com`): add them in the dashboard, set `FRONTEND_URL` / `NEXT_PUBLIC_API_URL` to them, and add the onrender.com frontend URL to `ALLOWED_ORIGINS` if it's still used. With both on the same site you can set `COOKIE_SAMESITE` back to `lax` or `strict`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Logs show Redis `ENOTFOUND` / connection timeouts | The Key Value instance is in a different region, or `REDIS_URL` is the external URL without access allowed |
| Sign-in succeeds but every request is 401 | `COOKIE_SAMESITE` isn't `none`, or the frontend isn't on https |
| 403 "Not allowed by CORS" | `FRONTEND_URL` on the API doesn't match the frontend's address exactly |
| AI features return defaults / `/health/ai` is degraded | No AI key on `confetti-ai`, or its `MONGODB_URI` is wrong |
| AI calls fail with 401 | `PYTHON_API_KEY` differs between services — redeploy `confetti-api` after changing it on `confetti-ai` |
| Payment returns to an ngrok error page | `PUBLIC_NGROK_URL` is set on the API — remove it |
| Can't sign in as super admin | Check the API logs at startup. "A super admin already exists … does not match" means an admin was created earlier with other credentials (e.g. by a local run against this database): sign in with those, or set `SUPER_ADMIN_RESET=true` on `confetti-api` for one deploy to apply `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`, then remove it |
