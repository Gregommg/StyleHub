# StyleHub — Fashion Online Store

A full-stack fashion e-commerce app with a customer storefront, shopping cart, checkout (cash on delivery), and a complete admin dashboard.

---

## Project Structure

```
stylehub/
├── backend/               # Node.js + Express API
│   ├── models/            # PostgreSQL schema + pool (db/), order rules (lib/)
│   ├── routes/            # auth, products, orders
│   ├── middleware/        # JWT auth middleware
│   ├── server.js          # Entry point
│   └── .env.example       # Environment variables template
│
└── frontend/
    └── public/
        ├── index.html     # Storefront
        ├── admin.html     # Admin dashboard
        ├── css/
        │   ├── style.css  # Storefront styles
        │   └── admin.css  # Admin styles
        └── js/
            ├── api.js     # API helper + demo data
            ├── cart.js    # Cart state & drawer
            ├── auth.js    # Login / register
            ├── shop.js    # Product listing, filters, search
            ├── checkout.js# KES checkout (delivery zones, cash on delivery)
            └── admin.js   # Admin dashboard logic
```

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Fill in your secrets
node server.js
```

The API will run at **http://localhost:5000**.

### 2. Frontend

Open `frontend/public/index.html` in a browser, or serve with any static server:

```bash
cd frontend/public
npx serve .
# → http://localhost:3000
```

> **Offline / demo mode**: The storefront can display built-in sample products while the API is unavailable. Placing orders and publishing products require the backend and database; checkout does not simulate successful orders.

---

## Features

### Storefront (index.html)
- Animated hero section
- Category browsing + pill filters
- Product grid with search and sorting
- Product detail modal with image gallery, sizes, wishlist and add to cart
- Slide-out cart drawer with quantity controls
- KES pricing and delivery options:
  - Langata door-to-door delivery: KES 50; customers can enter an address or use a map pin
  - Free Nairobi pickup at Langata China Square, Langata Hub, Development House (Nairobi CBD), Carrefour Ngong Road, or National Library
  - Outside Nairobi courier delivery: KES 200; county, town and nearby landmark are required
  - Cash on delivery (M-Pesa coming in a later update)
- Order confirmation screen
- Login / Register modal
- Fully responsive (mobile-friendly)

### Admin Dashboard (admin.html)
- Key stats: revenue, orders, products, customers
- Top-selling products table
- Recent orders widget
- **Products**: list all, filter by category, edit, remove
- **Add product**: publish or edit products with up to 5 photos
- **Orders**: list, filter by status, view customer delivery details, and update status
- Global search across products and orders

---

## Database (PostgreSQL)

1. Create a database: `createdb stylehub` (or create one on Render / Neon / Supabase).
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `JWT_SECRET` and the `ADMIN_*` values.
3. From `backend/`:

```bash
npm run migrate      # creates tables (safe to re-run)
npm run seed-admin   # creates/updates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm start
```

Tables: `users`, `products`, `orders`, `order_items`. Ids are UUIDs; the API still returns `_id` so the frontend works unchanged.

## Using the app

1. Start the backend (`npm start` in `backend/`) and the frontend (`npm run dev` in `frontend/`, serves on port 3000).
2. Open `http://localhost:3000`. The page talks to the API on port 5000 of the same host, so opening it as `localhost` or your PC's network address (e.g. `192.168.x.x`) both work.
3. **Admin:** sign in on the storefront with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (person icon). Admins are taken straight to the admin dashboard; customers stay in the store. Only admins can open `admin.html`; everyone else is sent back to the store.
4. **Customer account menu:** the person icon opens *Update your details*, *Change password*, *Delete account* and *Sign out*. Deleting an account removes the profile but keeps past orders on record for the store. Admin accounts can't be deleted from the app.
5. For a deployed site set `CLIENT_URL` (comma-separated) in the backend `.env` and `window.STYLEHUB_API_BASE` before `js/api.js` loads.

## Deploying

See `DEPLOY.md` for a free setup (Neon + Cloudinary + Render). Product photos are saved to Cloudinary when the
`CLOUDINARY_*` variables are set, otherwise to `backend/uploads` (fine on your PC, lost on free hosts).
`npm run check-images` tests your Cloudinary keys.

## Pictures & logo

- Category pictures live in `frontend/public/images/categories/` (illustrations). The file names are listed once in `CATEGORY_IMAGES` in `js/api.js`; point them at your own photos any time. Products without an uploaded photo show their category picture.
- Logo files are in `frontend/public/images/` (`stylehub-logo.jpeg` full logo, `stylehub-logo-nav.png` header version, `favicon.png`).

## Payments

Cash on delivery is the only payment method for now, in every delivery zone. An order is marked **paid** automatically when an admin sets it to *delivered* (or set `paymentStatus` explicitly via `PATCH /api/orders/:id`).
M-Pesa STK push is planned for the next update: add `"mpesa"` to `PAYMENT_METHODS` in `backend/lib/orderRules.js` and to the `payment_method` CHECK in `db/schema.sql`.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PGSSLMODE` | Set to `require` for hosted Postgres that needs SSL |
| `JWT_SECRET` | Random string, 32+ characters (server refuses to start otherwise) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloud storage for product photos |
| `AUTO_MIGRATE` | `true` to create/upgrade tables at start-up (hosts without a shell) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by `npm run seed-admin` (password 12+ chars) |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create customer account |
| POST | `/api/auth/login` | Sign in -> JWT |
| GET  | `/api/auth/me` | Current user |
| PATCH| `/api/auth/me` | Update your details (name, email, phone) |
| POST | `/api/auth/change-password` | Change password (other devices are signed out) |
| DELETE | `/api/auth/me` | Delete your account (customers only, needs password) |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET    | `/api/products` | List (category, search, featured, page, limit) |
| GET    | `/api/products/:id` | Single product |
| POST   | `/api/products` | Create + image upload (admin) |
| PUT    | `/api/products/:id` | Update (admin) |
| DELETE | `/api/products/:id` | Soft-delete (admin) |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| POST  | `/api/orders` | Place cash-on-delivery order (stock checked atomically) |
| GET   | `/api/orders/my` | Current user's orders |
| GET   | `/api/orders` | All orders (admin) |
| PATCH | `/api/orders/:id` | Update status / tracking / paymentStatus (admin) |
| GET   | `/api/orders/stats/summary` | Revenue & top products (admin) |

| GET | `/api/health` | Server + database check |

## Deployment Tips

- **Backend**: Deploy to Railway, Render, or a VPS. Use a managed PostgreSQL (Render, Neon, Supabase) and set `DATABASE_URL`.
- **Frontend**: Deploy to Vercel, Netlify, or any static host. Update `API_BASE` in `js/api.js`.
- **HTTPS**: Use your host's SSL in production.
"# StyleHub" 
