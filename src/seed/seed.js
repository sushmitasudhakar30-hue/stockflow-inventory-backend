// Fills the database with demo data: `npm run seed`.
// This wipes the collections it fills, so it refuses to run against production unless you pass --force.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';
import Supplier from '../models/Supplier.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Notification from '../models/Notification.js';
import { nextNumber } from '../models/Counter.js';

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe data in production. Re-run with --force if you really mean it.');
  process.exit(1);
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

await connectDB();
await mongoose.connection.dropDatabase();
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

const password = process.env.SEED_PASSWORD || 'Stockflow@123';
const passwordHash = await bcrypt.hash(password, 10);
const users = await User.insertMany([
  { name: 'Aarav Admin', email: 'admin@stockflow.com', role: 'Admin', avatar: 'AA', passwordHash },
  { name: 'Meera Manager', email: 'manager@stockflow.com', role: 'Warehouse Manager', avatar: 'MM', passwordHash },
  { name: 'Ishaan Staff', email: 'staff@stockflow.com', role: 'Inventory Staff', avatar: 'IS', passwordHash },
  { name: 'Sana Sales', email: 'sales@stockflow.com', role: 'Sales Staff', avatar: 'SS', passwordHash },
]);

// "Main Warehouse" sorts first, so it is the default warehouse for order stock.
const [main, north, south] = await Warehouse.insertMany([
  {
    name: 'Main Warehouse',
    location: 'Bengaluru, Karnataka',
    capacity: 10000,
    locations: [
      { rack: 'A1', bin: '01', productSku: 'LAP-001', quantity: 40 },
      { rack: 'A2', bin: '03', productSku: 'MOU-001', quantity: 150 },
    ],
  },
  { name: 'North Hub', location: 'Gurugram, Haryana', capacity: 6000 },
  { name: 'South Depot', location: 'Chennai, Tamil Nadu', capacity: 4000 },
]);

const catalog = [
  ['LAP-001', 'Business Laptop 14"', 'Electronics', 54999, 10, [40, 15, 5]],
  ['MOU-001', 'Wireless Mouse', 'Accessories', 799, 50, [150, 60, 40]],
  ['KEY-001', 'Mechanical Keyboard', 'Accessories', 3499, 25, [60, 20, 10]],
  ['MON-001', '24" IPS Monitor', 'Electronics', 11999, 15, [30, 10, 0]],
  ['HDD-001', '1TB External SSD', 'Storage', 7499, 20, [18, 6, 4]],
  ['USB-001', 'USB-C Hub 7-in-1', 'Accessories', 2199, 30, [80, 25, 15]],
  ['CAM-001', '1080p Webcam', 'Electronics', 2999, 20, [12, 4, 2]],
  ['HDP-001', 'Noise-Cancelling Headphones', 'Audio', 8999, 15, [22, 8, 0]],
  ['PRN-001', 'Laser Printer', 'Office', 15999, 8, [6, 2, 1]],
  ['PAP-001', 'A4 Paper Ream (500)', 'Office', 349, 100, [400, 150, 80]],
  ['CHR-001', 'Ergonomic Chair', 'Furniture', 12499, 10, [14, 5, 3]],
  ['DSK-001', 'Standing Desk', 'Furniture', 21999, 6, [9, 3, 0]],
].map(([sku, name, category, price, reorderLevel, qty]) => ({ sku, name, category, price, reorderLevel, qty }));

const products = await Product.insertMany(
  catalog.map(({ qty: _qty, ...p }) => ({ ...p, minStock: p.reorderLevel, maxStock: p.reorderLevel * 10 }))
);
const warehouses = [main, north, south];

const stockRows = [];
const movements = [];
products.forEach((p, i) => {
  catalog[i].qty.forEach((quantity, w) => {
    if (quantity <= 0) return;
    stockRows.push({ product: p._id, warehouse: warehouses[w]._id, quantity });
    movements.push({
      type: 'Stock In',
      product: p._id,
      warehouse: warehouses[w]._id,
      qty: quantity,
      user: users[1].name,
      note: 'Opening stock',
      createdAt: new Date(Date.now() - (10 - (i % 7)) * 86400000),
    });
  });
});
await Stock.insertMany(stockRows);
await Movement.insertMany(movements, { timestamps: false });

const suppliers = await Supplier.insertMany([
  {
    name: 'TechSource India',
    contactPerson: 'Ravi Kumar',
    email: 'ravi@techsource.in',
    phone: '+91 98450 11122',
    address: 'Whitefield, Bengaluru',
  },
  {
    name: 'Office Mart',
    contactPerson: 'Priya Nair',
    email: 'priya@officemart.in',
    phone: '+91 98860 33445',
    address: 'T. Nagar, Chennai',
  },
  {
    name: 'Furnico Interiors',
    contactPerson: 'Karan Mehta',
    email: 'karan@furnico.in',
    phone: '+91 99100 55667',
    address: 'Sector 18, Noida',
  },
]);

const price = (sku) => products.find((p) => p.sku === sku).price;
const lines = (...pairs) =>
  pairs.map(([sku, qty]) => ({ productId: products.find((p) => p.sku === sku)._id, qty, price: price(sku) }));
const sum = (items) => items.reduce((s, i) => s + i.qty * i.price, 0);

const poItems = [
  lines(['LAP-001', 10], ['MON-001', 10]),
  lines(['PAP-001', 200]),
  lines(['CHR-001', 5], ['DSK-001', 3]),
];
const poSpec = [
  [suppliers[0], 12, 'Pending', poItems[0]],
  [suppliers[1], 20, 'Received', poItems[1]],
  [suppliers[2], 3, 'Pending', poItems[2]],
];
for (const [s, age, status, items] of poSpec) {
  await PurchaseOrder.create({
    poNumber: await nextNumber('PO'),
    supplierId: s._id,
    date: daysAgo(age),
    items,
    total: sum(items),
    status,
  });
}

const soSpec = [
  ['Acme Traders', 1, 'Pending', lines(['MOU-001', 20], ['KEY-001', 5])],
  ['Bright Labs', 4, 'Pending', lines(['LAP-001', 2])],
  ['Cedar Offices', 6, 'Confirmed', lines(['PAP-001', 50])],
  ['Delta Retail', 9, 'Shipped', lines(['USB-001', 10])],
  ['Evergreen Co', 14, 'Delivered', lines(['HDP-001', 3])],
];
for (const [customer, age, status, items] of soSpec) {
  const holds = ['Confirmed', 'Shipped', 'Delivered'].includes(status);
  await SalesOrder.create({
    orderNumber: await nextNumber('SO'),
    customer,
    date: daysAgo(age),
    items,
    total: sum(items),
    status,
    warehouse: holds ? main._id : null,
  });
  if (holds) {
    // Keep the books consistent: held orders already took their stock out of the main warehouse.
    for (const i of items) {
      await Stock.updateOne({ product: i.productId, warehouse: main._id }, { $inc: { quantity: -i.qty } });
      await Movement.create({
        type: 'Stock Out',
        product: i.productId,
        warehouse: main._id,
        qty: i.qty,
        user: users[3].name,
        note: `Sales order (${customer})`,
      });
    }
  }
}

await Notification.insertMany([
  {
    type: 'low_stock',
    title: 'Out of Stock: 24" IPS Monitor (South)',
    message: 'No units left at South Depot',
    date: daysAgo(1),
  },
  { type: 'order_status', title: 'Order shipped', message: 'Delta Retail order is on its way', date: daysAgo(2) },
]);

console.log(
  `Seeded: ${users.length} users, ${products.length} products, ${warehouses.length} warehouses, ${suppliers.length} suppliers.`
);
console.log(`Sign in with admin@stockflow.com / ${password}`);
await mongoose.disconnect();
