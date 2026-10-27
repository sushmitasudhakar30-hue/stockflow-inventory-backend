// End-to-end API check. Needs the API running on a FRESHLY SEEDED database: `npm run seed`, then `npm run smoke`.
// It creates and changes records, so re-seed before running it again. Set API_URL if the API is not on port 5000.
const B = process.env.API_URL || 'http://localhost:5000/api';
let fails = 0;
const ok = (c, m) => {
  if (!c) {
    fails++;
    console.log('  FAIL:', m);
  } else console.log('  ok:', m);
};
async function call(method, path, body, token) {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = null;
  }
  return { s: r.status, j };
}
const login = async (e) => (await call('POST', '/auth/login', { email: e, password: 'Stockflow@123' })).j;
const admin = (await login('admin@stockflow.com')).token;
const sales = (await login('sales@stockflow.com')).token;
const staff = (await login('staff@stockflow.com')).token;
const mgr = (await login('manager@stockflow.com')).token;

console.log('AUTH');
let r = await call('POST', '/auth/login', { email: 'admin@stockflow.com', password: 'bad' });
ok(r.s === 401, 'bad password 401');
r = await call('GET', '/auth/me', undefined, admin);
ok(r.j.user.role === 'Admin' && !r.j.user.passwordHash && r.j.user.id, 'me returns user without hash');

console.log('READ SHAPES');
const products = (await call('GET', '/products', undefined, staff)).j;
const whs = (await call('GET', '/warehouses', undefined, staff)).j;
ok(
  products.length === 12 && typeof products[0].id === 'string' && products[0].warehouseStock,
  'products have string id + warehouseStock'
);
ok(whs[0].name === 'Main Warehouse', 'warehouses sorted, Main first');
const mv0 = (await call('GET', '/movements', undefined, sales)).j;
ok(
  mv0[0].productId && 'warehouseId' in mv0[0] && mv0[0].date && mv0[0].id,
  'movement DTO has productId/warehouseId/date/id'
);
r = await call('GET', '/suppliers', undefined, staff);
ok(r.s === 403, 'inventory staff 403 on suppliers (frontend maps to empty)');
r = await call('GET', '/sales-orders', undefined, staff);
ok(r.s === 403, 'inventory staff 403 on sales orders');
r = await call('GET', '/users', undefined, mgr);
ok(r.s === 403, 'manager 403 on users');
r = await call('GET', '/users', undefined, admin);
ok(r.s === 200 && r.j.length === 4 && !r.j[0].passwordHash, 'admin lists users');

const P = (sku) => products.find((p) => p.sku === sku);
const main = whs[0].id,
  north = whs.find((w) => w.name === 'North Hub').id;
const stockOf = async (pid, wid) =>
  (await call('GET', `/products/${pid}`, undefined, admin)).j.warehouseStock[wid] || 0;

console.log('STOCK MOVEMENTS');
const mouse = P('MOU-001');
const base = await stockOf(mouse.id, main);
r = await call('POST', '/movements/stock-in', { productId: mouse.id, warehouseId: main, qty: 10, note: 'x' }, staff);
ok(
  r.s === 201 &&
    r.j.movement.user === 'Ishaan Staff' &&
    r.j.stock[0].quantity === base + 10 &&
    r.j.stock[0].productId === mouse.id,
  'stock-in -> {movement, stock} with new qty, user from token'
);
r = await call('POST', '/movements/stock-out', { productId: mouse.id, warehouseId: main, qty: 999999 }, staff);
ok(r.s === 400 && /Insufficient/.test(r.j.message), 'oversell rejected');
r = await call(
  'POST',
  '/movements/transfer',
  { productId: mouse.id, fromWarehouseId: main, toWarehouseId: north, qty: 5 },
  staff
);
ok(
  r.s === 201 &&
    r.j.stock.length === 2 &&
    r.j.movement.fromWarehouseId === main &&
    r.j.movement.toWarehouseId === north,
  'transfer returns both stock rows'
);
r = await call('POST', '/movements/damaged', { productId: mouse.id, warehouseId: main, qty: 1, reason: 'wet' }, staff);
ok(r.s === 201 && r.j.movement.note === 'wet', 'damaged ok');
r = await call('POST', '/movements/stock-in', { productId: mouse.id, warehouseId: main, qty: 1 }, sales);
ok(r.s === 403, 'sales staff cannot move stock');

console.log('PRODUCTS / WAREHOUSES / SUPPLIERS CRUD');
r = await call('POST', '/products', { sku: 'tst-1', name: 'Test', category: 'Misc', price: 100, reorderLevel: 2 }, mgr);
ok(r.s === 201 && r.j.sku === 'TST-1' && r.j.id, 'create product');
const tid = r.j.id;
r = await call('POST', '/products', { sku: 'TST-1', name: 'Dup', category: 'Misc', price: 1 }, mgr);
ok(r.s === 409, 'dup SKU 409');
r = await call('PUT', `/products/${tid}`, { price: 150 }, mgr);
ok(r.j.price === 150, 'update product');
r = await call('POST', '/products', { sku: 'X', name: 'X', category: 'X', price: 1 }, staff);
ok(r.s === 403, 'staff cannot create product');
r = await call('DELETE', `/products/${tid}`, undefined, mgr);
ok(r.s === 200, 'delete product');
r = await call(
  'POST',
  `/warehouses/${north}/locations`,
  { rack: 'B', bin: '2', productSku: 'MOU-001', quantity: 3 },
  mgr
);
ok(r.s === 200 && r.j.locations.length >= 1, 'add location returns warehouse');
r = await call(
  'POST',
  '/suppliers',
  { name: 'New Sup', contactPerson: 'A', email: 'a@b.co', phone: '', address: '' },
  mgr
);
ok(r.s === 201, 'create supplier');
const sid = r.j.id;
r = await call('PUT', `/suppliers/${sid}`, { name: 'New Sup 2', contactPerson: 'A', email: 'a@b.co' }, mgr);
ok(r.j.name === 'New Sup 2', 'update supplier');
r = await call('DELETE', `/suppliers/${sid}`, undefined, mgr);
ok(r.s === 200, 'delete supplier');

console.log('SALES ORDER FLOW');
const lap = P('LAP-001');
const lapBase = await stockOf(lap.id, main);
r = await call(
  'POST',
  '/sales-orders',
  { customer: 'Zed Corp', date: '2026-10-20', items: [{ productId: lap.id, qty: 2, price: 1 }] },
  sales
);
ok(
  r.s === 201 && r.j.total === 2 * lap.price && r.j.items[0].price === lap.price && /^SO-/.test(r.j.orderNumber),
  'create: server prices items (ignores client price)'
);
const oid = r.j.id;
r = await call(
  'PUT',
  `/sales-orders/${oid}`,
  { customer: 'Zed Corp', date: '2026-10-20', items: [{ productId: lap.id, qty: 3 }] },
  sales
);
ok(r.s === 200 && r.j.total === 3 * lap.price, 'edit pending');
r = await call('POST', `/sales-orders/${oid}/confirm`, undefined, sales);
ok(
  r.s === 200 &&
    r.j.order.status === 'Confirmed' &&
    r.j.movements.length === 1 &&
    r.j.stock[0].quantity === lapBase - 3,
  'confirm deducts stock + returns {order,movements,stock}'
);
r = await call('POST', `/sales-orders/${oid}/confirm`, undefined, sales);
ok(r.s === 409, 'double confirm blocked');
ok((await stockOf(lap.id, main)) === lapBase - 3, 'stock deducted exactly once');
r = await call(
  'PUT',
  `/sales-orders/${oid}`,
  { customer: 'Z', date: '2026-10-20', items: [{ productId: lap.id, qty: 1 }] },
  sales
);
ok(r.s === 409, 'cannot edit confirmed');
r = await call('POST', `/sales-orders/${oid}/cancel`, undefined, sales);
ok(r.s === 403, 'sales staff cannot cancel');
r = await call('PATCH', `/sales-orders/${oid}/status`, { status: 'Shipped' }, sales);
ok(r.j.status === 'Shipped', 'ship');
r = await call('PATCH', `/sales-orders/${oid}/status`, { status: 'Delivered' }, sales);
ok(r.j.status === 'Delivered', 'deliver');
r = await call('POST', `/sales-orders/${oid}/return`, undefined, mgr);
ok(
  r.s === 200 && r.j.order.status === 'Returned' && (await stockOf(lap.id, main)) === lapBase,
  'return restores stock'
);
// insufficient: all-or-nothing
const mon = P('MON-001');
const monStock = await stockOf(mon.id, main);
r = await call(
  'POST',
  '/sales-orders',
  {
    customer: 'Big',
    date: '2026-10-20',
    items: [
      { productId: lap.id, qty: 1 },
      { productId: mon.id, qty: monStock + 1 },
    ],
  },
  sales
);
const big = r.j.id;
r = await call('POST', `/sales-orders/${big}/confirm`, undefined, sales);
ok(r.s === 400 && /Insufficient stock for/.test(r.j.message), 'short line rejected: ' + r.j.message);
ok(
  (await stockOf(lap.id, main)) === lapBase && (await stockOf(mon.id, main)) === monStock,
  'all-or-nothing: no partial deduction'
);
r = await call('GET', '/sales-orders', undefined, sales);
ok(r.j.find((o) => o.id === big).status === 'Pending', 'failed confirm leaves order Pending');
r = await call('DELETE', `/sales-orders/${big}`, undefined, mgr);
ok(r.s === 200 && r.j.stock.length === 0, 'delete pending: no stock change');
// cancel confirmed + delete delivered
r = await call(
  'POST',
  '/sales-orders',
  { customer: 'C', date: '2026-10-21', items: [{ productId: lap.id, qty: 1 }] },
  sales
);
const c1 = r.j.id;
await call('POST', `/sales-orders/${c1}/confirm`, undefined, sales);
r = await call('POST', `/sales-orders/${c1}/cancel`, undefined, mgr);
ok(r.j.order.status === 'Cancelled' && (await stockOf(lap.id, main)) === lapBase, 'cancel confirmed restores stock');
r = await call(
  'POST',
  '/sales-orders',
  { customer: 'D', date: '2026-10-21', items: [{ productId: lap.id, qty: 2 }] },
  sales
);
const d1 = r.j.id;
await call('POST', `/sales-orders/${d1}/confirm`, undefined, sales);
r = await call('DELETE', `/sales-orders/${d1}`, undefined, admin);
ok(
  r.s === 200 && r.j.movements.length === 1 && (await stockOf(lap.id, main)) === lapBase,
  'delete confirmed restores stock'
);
// concurrency
r = await call(
  'POST',
  '/sales-orders',
  { customer: 'Race', date: '2026-10-21', items: [{ productId: lap.id, qty: 4 }] },
  sales
);
const race = r.j.id;
const rs = await Promise.all([1, 2, 3, 4].map(() => call('POST', `/sales-orders/${race}/confirm`, undefined, sales)));
ok(
  rs.filter((x) => x.s === 200).length === 1 && (await stockOf(lap.id, main)) === lapBase - 4,
  'concurrent confirms: exactly one wins, stock deducted once'
);
await call('POST', `/sales-orders/${race}/cancel`, undefined, mgr);

console.log('PURCHASE ORDER FLOW');
const pos = (await call('GET', '/purchase-orders', undefined, sales)).j;
ok(pos.length === 3 && pos[0].supplierId, 'list POs');
const pend = pos.find((p) => p.status === 'Pending');
const it = pend.items[0];
const before = await stockOf(it.productId, main);
r = await call('POST', `/purchase-orders/${pend.id}/receive`, undefined, sales);
ok(r.s === 403, 'sales cannot receive');
r = await call('POST', `/purchase-orders/${pend.id}/receive`, undefined, mgr);
ok(
  r.s === 200 && r.j.order.status === 'Received' && (await stockOf(it.productId, main)) === before + it.qty,
  'receive adds stock'
);
r = await call('POST', `/purchase-orders/${pend.id}/receive`, undefined, mgr);
ok(r.s === 409, 'double receive blocked');
ok((await stockOf(it.productId, main)) === before + it.qty, 'stock added once');
const sup = (await call('GET', '/suppliers', undefined, mgr)).j[0];
r = await call(
  'POST',
  '/purchase-orders',
  { supplierId: sup.id, date: '2026-10-22', items: [{ productId: lap.id, qty: 5 }] },
  mgr
);
ok(r.s === 201 && /^PO-/.test(r.j.poNumber), 'create PO');
r = await call('DELETE', `/suppliers/${sup.id}`, undefined, mgr);
ok(r.s === 409, 'supplier with POs cannot be deleted');

console.log('USERS');
r = await call(
  'POST',
  '/users',
  { name: 'Tia Test', email: 'TIA@x.com', password: 'secret1', role: 'Sales Staff', avatar: 'TT' },
  admin
);
ok(r.s === 201 && r.j.email === 'tia@x.com' && r.j.active, 'create user');
const uid = r.j.id;
const tia = await call('POST', '/auth/login', { email: 'tia@x.com', password: 'secret1' });
ok(tia.s === 200, 'new user can log in');
r = await call('PATCH', `/users/${uid}/toggle-active`, undefined, admin);
ok(r.j.active === false, 'deactivate');
r = await call('GET', '/auth/me', undefined, tia.j.token);
ok(r.s === 401, 'deactivated user token rejected immediately');
r = await call('POST', '/auth/login', { email: 'tia@x.com', password: 'secret1' });
ok(r.s === 403, 'deactivated user cannot log in');
const adminId = (await call('GET', '/auth/me', undefined, admin)).j.user.id;
r = await call('PATCH', `/users/${adminId}/toggle-active`, undefined, admin);
ok(r.s === 400, 'admin cannot deactivate self');
r = await call('PUT', `/users/${uid}`, { name: 'Tia T', role: 'Admin', password: 'newpass1' }, admin);
ok(r.s === 200 && r.j.role === 'Admin', 'update user');

console.log('NOTIFICATIONS');
r = await call('POST', '/notifications', { type: 'low_stock', title: 'Low', message: 'm' }, staff);
ok(r.s === 201 && r.j.read === false, 'create');
const nid = r.j.id;
r = await call('PATCH', `/notifications/${nid}/read`, undefined, staff);
ok(r.j.read === true, 'mark read');
r = await call('GET', '/notifications', undefined, sales);
ok(r.j.find((n) => n.id === nid).read === false, 'read state is per-user');
await call('PATCH', '/notifications/read-all', undefined, sales);
r = await call('GET', '/notifications', undefined, sales);
ok(
  r.j.every((n) => n.read),
  'mark all read'
);

console.log('ERRORS / CORS');
r = await call('GET', '/products/not-an-id', undefined, admin);
ok(r.s === 400 || r.s === 404 || r.s === 500, 'bad id handled: ' + r.s);
r = await call('GET', '/nope', undefined, admin);
ok(r.s === 404, '404 JSON');
const pre = await fetch(B + '/sales-orders/x/status', {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'authorization,content-type',
  },
});
ok(
  pre.headers.get('access-control-allow-origin') === 'http://localhost:5173' &&
    /PATCH/.test(pre.headers.get('access-control-allow-methods')),
  'CORS preflight allows PATCH + Authorization from frontend'
);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
