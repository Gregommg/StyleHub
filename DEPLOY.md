# Deploying StyleHub for free

Free setup: **Neon** (database) + **Cloudinary** (product photos) + **Render** (backend and frontend).
Free plans change, so check each site's pricing page when you sign up.

Why three services? Render's free web service forgets any file saved on its disk whenever it restarts, so product
photos must live elsewhere (Cloudinary). Render's own free database also expires after 30 days, so use Neon for the database.

What to expect: the free backend goes to sleep after about 15 minutes with no visitors, and the first visit after that
takes up to a minute to wake it. Fine for testing and a small shop; not for heavy traffic.

---

## 1. Database: Neon
1. Create a free account at neon.tech and create a project (any name, pick the region closest to Kenya that is offered).
2. Copy the **connection string** (starts with `postgresql://`). Keep it private, it contains your password.

## 2. Product photos: Cloudinary
1. Create a free account at cloudinary.com.
2. On the dashboard copy your **Cloud name**, **API Key** and **API Secret**.

## 3. Test both from your own PC (recommended, 2 minutes)
In `backend\.env` set `DATABASE_URL` to the Neon string, add `PGSSLMODE=require`, and fill the three `CLOUDINARY_` values. Then in `backend`:

```
npm run migrate
npm run seed-admin
npm run check-images
```
- `migrate` creates your tables in Neon.
- `seed-admin` creates your admin login (from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`).
- `check-images` uploads a tiny test picture and prints its link, proving Cloudinary works.

## 4. Backend: Render "Web Service"
1. Put the project on GitHub (the `.gitignore` already keeps `.env` and `node_modules` out).
2. In Render: **New > Web Service**, connect the repo, and set:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: **Free**
3. Add these Environment Variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon connection string |
| `PGSSLMODE` | `require` |
| `JWT_SECRET` | a long random string (32+ characters) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from Cloudinary |
| `AUTO_MIGRATE` | `true` (creates/updates tables on start, since the free plan has no shell) |
| `CLIENT_URL` | your frontend address from step 5 (add it after step 5, then redeploy) |

4. When it is live, open `https://YOUR-BACKEND.onrender.com/api/health`. You should see `{"status":"ok","database":"up"}`.

## 5. Frontend: Render "Static Site"
1. In Render: **New > Static Site**, same repo, and set:
   - Publish Directory: `frontend/public`
   - Build Command: leave empty
2. Open `frontend/public/js/config.js`, remove the `//` from the last line and set your backend address
   (`https://YOUR-BACKEND.onrender.com/api`), commit and push so the site redeploys.
3. Copy the static site's address into the backend's `CLIENT_URL` (step 4) and redeploy the backend.

## 6. Go live checklist
- Sign in with your admin email and password on the site, add a product with a photo, then restart the backend
  on Render ("Manual Deploy") and confirm the photo is still there.
- Register a test customer and place a cash order.
- Never commit `.env`. If a secret was ever shared (like the old MongoDB password), change it.
