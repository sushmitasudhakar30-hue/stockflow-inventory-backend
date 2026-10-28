# StockFlow Inventory Backend

Node.js + Express + MongoDB/Mongoose backend for the Product & Inventory module.

## Setup

1. Install Node.js LTS and MongoDB Community Server, or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env`.
3. Set `MONGO_URI`.
4. Run `npm install`.
5. Run `npm run dev`.

Default API: http://localhost:5000
Health check: GET /api/health

## Setup for the full app

1. `cp .env.example .env`, then set `MONGO_URI` and a long random `JWT_SECRET`.
2. `npm install`
3. `npm run seed` — creates demo users, products, warehouses, suppliers and orders (wipes the database; refuses to run in production without `--force`).
4. `npm run dev` — API on http://localhost:5000
5. Start the [frontend](https://github.com/sushmitasudhakar30-hue/stockflow-frontend) with `VITE_API_URL=http://localhost:5000/api` and sign in with `admin@stockflow.com` / `Stockflow@123` (also `manager@`, `staff@`, `sales@stockflow.com`).

`CLIENT_URL` must list the frontend's origin (comma-separate several). `npm run smoke` runs an end-to-end API check against a freshly seeded database.

## API

Every route except `/api/health` and `POST /api/auth/login` needs `Authorization: Bearer <token>`.
Roles: **A**dmin, Warehouse **M**anager, **I**nventory Staff, **S**ales Staff.

| Area            | Endpoints                                                                                   | Who      |
| --------------- | ------------------------------------------------------------------------------------------- | -------- |
| Auth            | `POST /auth/login`, `GET /auth/me`                                                          | everyone |
| Users           | `GET/POST /users`, `PUT /users/:id`, `PATCH /users/:id/toggle-active`                       | A        |
| Products        | `GET /products`, `GET /products/categories`, `GET /products/:id`                            | all      |
|                 | `POST /products`, `PUT/DELETE /products/:id`                                                | A, M     |
| Warehouses      | `GET /warehouses`, `GET /warehouses/:id`                                                    | all      |
|                 | `POST /warehouses`, `POST /warehouses/:id/locations`                                        | A, M     |
| Movements       | `GET /movements`                                                                            | all      |
|                 | `POST /movements/stock-in`, `stock-out`, `transfer`, `damaged`                              | A, M, I  |
| Suppliers       | `GET /suppliers`                                                                            | A, M, S  |
|                 | `POST /suppliers`, `PUT/DELETE /suppliers/:id`                                              | A, M     |
| Sales orders    | `GET/POST /sales-orders`, `PUT /sales-orders/:id`, `POST /:id/confirm`, `PATCH /:id/status` | A, M, S  |
|                 | `POST /:id/cancel`, `POST /:id/return`, `DELETE /:id`                                       | A, M     |
| Purchase orders | `GET /purchase-orders`                                                                      | A, M, S  |
|                 | `POST /purchase-orders`, `POST /purchase-orders/:id/receive`                                | A, M     |
| Notifications   | `GET/POST /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | all      |

Stock-changing calls answer `{ movement(s), stock: [{ productId, warehouseId, quantity }] }` with the new quantities.
Order totals and prices are always calculated on the server from the product table. Confirming a sales order deducts
stock from the first warehouse (A-Z) all-or-nothing; cancel / return / delete put it back; receiving a purchase order adds it once.
