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

## API

Products

- GET /api/products
- GET /api/products/:id
- GET /api/products/categories
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id

Warehouses

- GET /api/warehouses
- GET /api/warehouses/:id
- POST /api/warehouses

Inventory movements

- GET /api/movements
- POST /api/movements/stock-in
- POST /api/movements/stock-out
- POST /api/movements/transfer
- POST /api/movements/damaged

Example product body:
{
"sku": "ELEC-004",
"name": "Wireless Keyboard",
"category": "Electronics",
"price": 599,
"reorderLevel": 50,
"brand": "Logitech",
"description": "Wireless keyboard",
"unit": "Piece"
}

Example stock-in body:
{
"productId": "PRODUCT_OBJECT_ID",
"warehouseId": "WAREHOUSE_OBJECT_ID",
"qty": 50,
"user": "Admin",
"note": "Opening stock"
}

## Development

- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- CI runs lint and format checks on every PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for branching and PR rules.
