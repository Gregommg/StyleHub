CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  avatar     TEXT NOT NULL DEFAULT '',
  address    JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone      TEXT NOT NULL DEFAULT '',
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Upgrades for databases created by an earlier version (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  category    TEXT NOT NULL CHECK (category IN ('Tops','Bottoms','Dresses','Outerwear','Accessories')),
  images      TEXT[] NOT NULL DEFAULT '{}',
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sizes       TEXT[] NOT NULL DEFAULT '{}',
  colors      TEXT[] NOT NULL DEFAULT '{}',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  featured    BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  sold_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category) WHERE active;
CREATE INDEX IF NOT EXISTS products_created_idx ON products (created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL after the customer deletes their account; the order is kept for the store's records
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_zone    TEXT NOT NULL CHECK (delivery_zone IN ('langata','nairobi-pickup','outside-nairobi')),
  pickup_location  TEXT NOT NULL DEFAULT '',
  subtotal         NUMERIC(12,2) NOT NULL,
  shipping_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled')),
  -- Cash only for now. Add 'mpesa' here when STK push is built.
  payment_method   TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  tracking_number  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,
  price      NUMERIC(12,2) NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  size       TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
