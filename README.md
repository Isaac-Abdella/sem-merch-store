# Linawaa Dash Delivery — MERN store with local delivery

A working starting point for an online merch store that:

- **Restricts accounts and deliveries to 25 km of downtown Toronto**, checked server-side by geocoding the address
- **Takes payments with Stripe**, with a built-in **mock provider** so you can test checkout without any keys
- **Shows live delivery tracking on a map** (Leaflet + OpenStreetMap), pushed in real time over Socket.io
- Has **customer, driver and admin** roles with a small admin dashboard and a driver console

Stack: MongoDB · Express 5 · React 19 (Vite) · Node 20+ · Mongoose · Socket.io · Stripe · Leaflet · Zod

---

## Quick start (about 5 minutes)

**You need:** Node.js 20 or newer, and MongoDB (Docker, a local install, or a free MongoDB Atlas cluster).

```bash
# 1. Install everything and create server/.env + client/.env (with a random JWT secret)
npm run setup

# 2. Start MongoDB (skip if you use Atlas or a local install — then set MONGO_URI in server/.env)
npm run db:up

# 3. Add sample products and test accounts
npm run seed

# 4. Run the API (port 5000) and the React app (port 5173) together
npm run dev
```

Open **http://localhost:5173** and log in with a seeded account:

| Role     | Email                  | Password       |
|----------|------------------------|----------------|
| Customer | customer@example.com   | Customer123!   |
| Driver   | driver@example.com     | Driver123!     |
| Admin    | admin@example.com      | Admin123!      |

Out of the box it runs fully offline-friendly: `GEOCODER=mock` and `PAYMENT_PROVIDER=mock`.

---

## Folder structure

```
merch-store/
├── package.json              # root scripts: setup, dev, seed, test, db:up
├── docker-compose.yml        # local MongoDB
├── scripts/setup.js          # creates .env files
│
├── server/                   # Express API
│   ├── src/
│   │   ├── app.js            # middleware + routes (webhook route BEFORE express.json!)
│   │   ├── server.js         # HTTP server + Socket.io + DB connect
│   │   ├── config/           # db, stripe, serviceArea (center + radius), pricing (HST, delivery fee)
│   │   ├── models/           # User, Product, Order, Shipment (+ shared GeoJSON/address schemas)
│   │   ├── controllers/      # auth, product, order, payment, webhook, tracking, serviceArea
│   │   ├── routes/           # one router per controller
│   │   ├── middleware/       # auth (JWT cookie), admin/driver roles, serviceArea geofence,
│   │   │                     # validate (zod), rateLimit, errorHandler
│   │   ├── services/         # geocode, geo (haversine), pricing, payment, order fulfilment, shipping
│   │   ├── sockets/          # tracking.js — Socket.io rooms per order
│   │   ├── validators/       # zod request schemas
│   │   └── utils/            # AppError, generateToken, cookies, permissions
│   ├── seed/seedProducts.js
│   └── tests/                # node:test — unit + full API integration test
│
└── client/                   # React (Vite)
    └── src/
        ├── api/              # axios instance + one file per API area
        ├── components/       # layout, products, cart, checkout (Stripe), map (Leaflet)
        ├── context/          # AuthContext, CartContext (localStorage)
        ├── hooks/            # useAuth, useGeolocation, useOrderSocket
        ├── pages/            # shop, cart, checkout, tracking, auth, admin/, driver/
        ├── routes/           # ProtectedRoute, AdminRoute
        └── utils/            # currency + order status helpers
```

---

## How the key parts work

### 1. The 25 km Toronto geofence

`server/src/config/serviceArea.js` defines the center (Toronto City Hall) and radius (25 km). Change it with `SERVICE_CENTER_LAT`, `SERVICE_CENTER_LNG` and `SERVICE_RADIUS_KM`.

`middleware/serviceArea.js` geocodes the submitted address **on the server**, measures the haversine distance, and returns `403 { code: "OUT_OF_SERVICE_AREA", distanceKm }` when it's too far. It runs on:

- `POST /api/auth/register` — you can only create an account with an address in the area
- `PUT /api/auth/me/address`
- `POST /api/payments/create-intent` — every order's delivery address is re-checked

**Why the address and not the login?** Browser GPS and IP location are easy to fake (VPNs, devtools), so they can't be the real gate. If you also want a soft check at login, set `STRICT_LOGIN_GEOFENCE=true`. The login page then asks for the browser's location and the server rejects customers outside the circle. Admins and drivers are exempt.

**Geocoders** (`services/geocodeService.js`):

- `GEOCODER=mock` looks up city names offline. Toronto, North York, Etobicoke, Scarborough, Mississauga, Vaughan and Markham are inside; Richmond Hill, Brampton, Oakville, Pickering, Hamilton, Oshawa, Barrie and Ottawa are outside. Use it for development and tests.
- `GEOCODER=nominatim` uses OpenStreetMap's free geocoder. It's fine for development, but its policy is max 1 request/second with a real User-Agent. For production, add a paid provider (Google Geocoding, Mapbox, Geocodio) as another function in the same file.

### 2. Payments

The flow lives in `controllers/paymentController.js` and `webhookController.js`:

1. The client sends **only product ids and quantities** plus the address.
2. The server loads prices from MongoDB, checks stock, and calculates subtotal + delivery + 13% HST in integer cents (`services/pricingService.js`).
3. It creates a `pending` Order and a Stripe PaymentIntent (with an idempotency key).
4. The browser confirms the payment with Stripe's Payment Element, so card data never touches your server.
5. **Stripe's webhook** (`payment_intent.succeeded`) marks the order paid, decrements stock, creates the Shipment and pushes a live update. The success page just polls until that happens.

`services/orderService.js` is idempotent, so Stripe retrying a webhook won't double-decrement stock.

**Switching from mock to real Stripe (test mode):**

1. Create a Stripe account → Developers → API keys (test mode).
2. In `server/.env`: `PAYMENT_PROVIDER=stripe` and `STRIPE_SECRET_KEY=sk_test_...`
3. In `client/.env`: `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
4. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:5000/api/webhooks/stripe
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` and restart the API.
5. Pay with `4242 4242 4242 4242`, any future expiry, any CVC. Use `4000 0025 0000 3155` to test 3-D Secure, or `4000 0000 0000 9995` for a decline.

To add Helcim or Moneris later, add a provider to `services/paymentService.js` with the same `createPayment` shape plus its webhook route. Controllers don't need to change.

### 3. Delivery tracking map

- **Shipment** (`models/Shipment.js`) stores origin, destination, current location and a breadcrumb `path` (GeoJSON, `[lng, lat]` order).
- A driver posts GPS to `POST /api/tracking/:orderId/location`. The server saves it, auto-moves the order to *out for delivery*, and emits `tracking:update` to the Socket.io room `order:<id>`.
- `client/src/pages/TrackOrder.jsx` loads the shipment and subscribes with `useOrderSocket`. The courier marker moves live.
- Sockets authenticate with the same httpOnly JWT cookie, and only the order's customer, its assigned driver, or an admin can subscribe.
- For carrier shipments (Canada Post, Purolator, UPS), `services/shippingService.js` has a placeholder: poll the carrier API or an aggregator like EasyPost/Shippo, then call `shipment.recordLocation()` for each scan.

### 4. Auth

- Passwords are hashed with bcrypt (12 rounds).
- JWT is stored in an **httpOnly, SameSite=Lax cookie** (not localStorage), so page scripts can't steal it.
- Roles: `customer`, `driver`, `admin`. `middleware/auth.js` has `protect` and `authorize(...roles)`.
- Login and register are rate-limited. All input is validated with zod, including Canadian postal codes.
- In development the Vite proxy puts the API on the same origin as the app, so cookies need no CORS tricks.

### 5. Product options (size / weight / volume)

- Each product has an `optionType`: `none`, `size`, `weight` or `volume`. With options, it has a list of `variants`, each `{ label, price, stock }` (e.g. `250 g` at $14.99, 12 in stock).
- The shopper picks one option before adding to the cart; each option is its own cart line. Checkout sends `variantId`, and the server prices and checks stock **per option**. Paying decrements that option's stock.
- The product's own `price` and `stock` are kept in sync automatically: the cheapest option ("From $X" in the shop) and the total of all options.
- Admins set options under **Admin → Products**: choose the option type when adding a product, or use the **Options** button on an existing one.
- Databases created before options existed: `npm run migrate:variants --prefix server` turns the old `sizes` list into size options.

---

## Testing each part

### Automated tests

```bash
npm test                                   # all server tests (37)
npm run test:unit --prefix server          # geofence math, pricing, middleware — no DB needed
npm run test:integration --prefix server   # full API flow against MongoDB
```

The integration test downloads a throwaway in-memory MongoDB the first time (~100 MB). To use your own instead:

```bash
MONGO_URI_TEST=mongodb://127.0.0.1:27017/merch-store-test npm run test:integration --prefix server
```

It covers: geofenced registration, validation errors, duplicate emails, checkout to an outside address being blocked, stock limits, server-side pricing (client prices ignored), payment idempotency, order privacy between customers, driver assignment, live location updates, and admin-only routes.

> The tests use Node's built-in test runner rather than Jest: Jest's module sandbox currently breaks the MongoDB driver's connection handshake.

### Manual walkthrough in the browser

1. **Geofence:** Register with city `Brampton` (or `Barrie`), and you're sent to the "we don't deliver there" page. Register with `Markham` and it works.
2. **Shopping:** Add a few items. The cart shows an estimate; checkout shows the server's final totals. The *Sticker Pack* has stock 3, so try buying 4.
3. **Checkout (mock):** Click "Simulate paying". You land on the success page and the order shows as paid.
4. **Admin:** Log in as admin in a private window → Admin → Orders. Assign `driver@example.com` to the order.
5. **Driver:** Log in as the driver in another private window → Deliveries → **Simulate drive**.
6. **Live map:** As the customer, open My orders → Track. The courier moves across the map every 2 seconds without a page refresh. The driver then clicks **Mark delivered**.
7. **Real GPS:** Open the driver page on your phone (it needs HTTPS or localhost; a tunnel like `ngrok http 5173` works) and use **Share live GPS**.

### Testing the API directly (curl / Postman)

```bash
# Log in and save the cookie
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"Customer123!"}' http://localhost:5000/api/auth/login

# Check an address against the service area
curl -H 'Content-Type: application/json' \
  -d '{"address":{"line1":"1 Main St","city":"Kitchener","postalCode":"N2G 1A1"}}' \
  http://localhost:5000/api/service-area/check
```

---

## API reference

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/health` | anyone | |
| POST | `/api/auth/register` | anyone | geofenced |
| POST | `/api/auth/login` | anyone | optional `coords` for strict mode |
| POST | `/api/auth/logout` | anyone | |
| GET | `/api/auth/me` | user | |
| PUT | `/api/auth/me/address` | user | geofenced |
| GET | `/api/products` | anyone | `?q=&category=&page=&limit=` |
| GET | `/api/products/categories` | anyone | |
| GET | `/api/products/:idOrSlug` | anyone | |
| GET | `/api/products/admin/all` | admin | includes hidden products |
| POST / PATCH / DELETE | `/api/products[/:id]` | admin | DELETE hides (soft delete) |
| GET | `/api/orders/mine` | user | |
| GET | `/api/orders/:id` | owner / admin / assigned driver | |
| GET | `/api/orders` | admin | `?status=` |
| PATCH | `/api/orders/:id/status` | admin | |
| PATCH | `/api/orders/:id/assign-driver` | admin | `{ driverEmail }` |
| GET | `/api/payments/config` | anyone | which provider is active |
| POST | `/api/payments/create-intent` | user | geofenced; creates order |
| POST | `/api/payments/mock/:orderId/confirm` | user | dev only |
| POST | `/api/webhooks/stripe` | Stripe | signature-verified |
| GET | `/api/tracking/:orderId` | owner / admin / assigned driver | |
| POST | `/api/tracking/:orderId/location` | assigned driver / admin | `{ lat, lng }` |
| POST | `/api/tracking/:orderId/status` | assigned driver / admin | shipped / out_for_delivery / delivered |
| GET | `/api/tracking/driver/assigned` | driver / admin | |
| GET | `/api/service-area` | anyone | center + radius |
| POST | `/api/service-area/check` | anyone | `{ address }` |

**Socket.io:** connect with credentials, `emit('order:subscribe', orderId, ack)`, then listen for `tracking:update` events containing `{ orderId, status?, location?, note?, at }`.

---

## Troubleshooting

- **`EADDRINUSE: address already in use :::5000`**: something else is on port 5000. On macOS this is usually *AirPlay Receiver* (System Settings → General → AirDrop & Handoff). Either turn it off, or set `PORT=5050` in `server/.env` and start the client with `VITE_PROXY_TARGET=http://localhost:5050`.
- **"Is the API running on port 5000?" on the home page**: the API isn't up or can't reach MongoDB. Check the `[api]` lines in the terminal and `MONGO_URI` in `server/.env`.
- **Map is grey**: map tiles load from openstreetmap.org, so check your internet connection or ad blocker.
- **Stripe payment succeeds but the order stays "Confirming…"**: the webhook isn't reaching the API. Check that `stripe listen` is running and that `STRIPE_WEBHOOK_SECRET` matches what it printed.
- **"Location permission was denied"**: browsers only allow geolocation on `https://` or `http://localhost`.

---

## Before going to production

- [ ] Use a paid geocoder and map tile provider (OSM's free services aren't meant for production traffic).
- [ ] Set `NODE_ENV=production`. This makes cookies `Secure` and disables the mock payment provider.
- [ ] Deploy the API behind HTTPS. If the client is on a different domain, set `CLIENT_URL`, `VITE_API_URL` and `VITE_SOCKET_URL`, and consider `sameSite: 'none'` cookies, or better, serve both under one domain.
- [ ] Register the production webhook endpoint in the Stripe dashboard and use its signing secret.
- [ ] Add a scheduled job to cancel `pending` orders older than ~1 hour (abandoned checkouts).
- [ ] Add email notifications (order confirmed, out for delivery), password reset and email verification.
- [ ] Consider Interac Online / PayPal as extra payment options for Canadian customers.
- [ ] Have an accountant confirm HST treatment for your products and delivery fees (`config/pricing.js`).
