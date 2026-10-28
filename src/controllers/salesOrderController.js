import SalesOrder from '../models/SalesOrder.js';
import { nextNumber } from '../models/Counter.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { movementDTO, salesOrderDTO, stockRow } from '../utils/serializers.js';
import { addLines, defaultWarehouse, recordMovements, removeLines } from '../services/stockService.js';
import { buildItems, checkDate } from '../services/orderItems.js';

async function findOrder(id) {
  const order = await SalesOrder.findById(id);
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

const lines = (order) => order.items.map((i) => ({ productId: i.productId, qty: i.qty }));

// One movement per order line, tagged with the order number so the history explains itself.
const movementDocs = (order, type, warehouseId, user, note) =>
  order.items.map((i) => ({ type, product: i.productId, warehouse: warehouseId, qty: i.qty, user, note }));

// Moves the order from `from` to `to` in ONE atomic update. Only one request can win, so double-clicks and
// races can never confirm / cancel the same order twice (and therefore never move its stock twice).
async function claim(id, from, to, extra = {}) {
  const order = await SalesOrder.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { status: to, ...extra },
    { new: true }
  );
  if (!order) {
    const current = await findOrder(id);
    throw new HttpError(409, `Order is ${current.status}; it can't be changed this way`);
  }
  return order;
}

const stockResponse = (order, movements, rows, extra = {}) => ({
  order: salesOrderDTO(order),
  movements: movements.map(movementDTO),
  stock: rows.map(stockRow),
  ...extra,
});

export const getSalesOrders = asyncHandler(async (req, res) => {
  const orders = await SalesOrder.find().sort({ date: -1, createdAt: -1 });
  res.json(orders.map(salesOrderDTO));
});

export const createSalesOrder = asyncHandler(async (req, res) => {
  const { customer, date } = req.body;
  if (!customer?.trim()) throw new HttpError(400, 'Customer name is required');
  const { items, total } = await buildItems(req.body.items);
  const order = await SalesOrder.create({
    orderNumber: await nextNumber('SO'),
    customer,
    date: checkDate(date),
    items,
    total,
  });
  res.status(201).json(salesOrderDTO(order));
});

export const updateSalesOrder = asyncHandler(async (req, res) => {
  const { customer, date } = req.body;
  if (!customer?.trim()) throw new HttpError(400, 'Customer name is required');
  const { items, total } = await buildItems(req.body.items);
  const order = await SalesOrder.findOneAndUpdate(
    { _id: req.params.id, status: 'Pending' },
    { customer, date: checkDate(date), items, total },
    { new: true, runValidators: true }
  );
  if (!order) {
    await findOrder(req.params.id);
    throw new HttpError(409, 'Only pending orders can be edited');
  }
  res.json(salesOrderDTO(order));
});

// Pending -> Confirmed: deducts every line from the default warehouse, all or nothing.
export const confirmSalesOrder = asyncHandler(async (req, res) => {
  const warehouse = await defaultWarehouse();
  const order = await claim(req.params.id, ['Pending'], 'Confirmed', { warehouse: warehouse._id });
  let rows;
  try {
    rows = await removeLines(lines(order), warehouse._id);
  } catch (error) {
    await SalesOrder.updateOne({ _id: order._id }, { status: 'Pending', warehouse: null });
    throw error;
  }
  const movements = await recordMovements(
    movementDocs(order, 'Stock Out', warehouse._id, req.user.name, `Sales order ${order.orderNumber}`),
    async () => {
      await addLines(lines(order), warehouse._id);
      await SalesOrder.updateOne({ _id: order._id }, { status: 'Pending', warehouse: null });
    }
  );
  res.json(stockResponse(order, movements, rows));
});

// Confirmed -> Shipped -> Delivered. No stock change.
export const updateSalesOrderStatus = asyncHandler(async (req, res) => {
  const next = { Shipped: 'Confirmed', Delivered: 'Shipped' }[req.body.status];
  if (!next) throw new HttpError(400, "Status must be 'Shipped' or 'Delivered'");
  const order = await claim(req.params.id, [next], req.body.status);
  res.json(salesOrderDTO(order));
});

// Puts the order's stock back in the warehouse it came from.
async function restoreStock(order, user, note) {
  const rows = await addLines(lines(order), order.warehouse);
  const movements = await recordMovements(movementDocs(order, 'Stock In', order.warehouse, user, note), () =>
    removeLines(lines(order), order.warehouse)
  );
  return { rows, movements };
}

async function reverse(req, res, from, to, note) {
  const order = await claim(req.params.id, from, to);
  if (!order.warehouse) return res.json(stockResponse(order, [], []));
  try {
    const { rows, movements } = await restoreStock(order, req.user.name, `${note} ${order.orderNumber}`);
    res.json(stockResponse(order, movements, rows));
  } catch (error) {
    await SalesOrder.updateOne({ _id: order._id }, { status: from[0] });
    throw error;
  }
}

// Pending / Confirmed -> Cancelled
export const cancelSalesOrder = asyncHandler(async (req, res) => {
  const order = await findOrder(req.params.id);
  if (order.status === 'Pending') {
    const cancelled = await claim(order._id, ['Pending'], 'Cancelled');
    return res.json(stockResponse(cancelled, [], []));
  }
  await reverse(req, res, ['Confirmed'], 'Cancelled', 'Cancelled order');
});

// Delivered -> Returned
export const returnSalesOrder = asyncHandler(async (req, res) => {
  await reverse(req, res, ['Delivered'], 'Returned', 'Returned order');
});

export const deleteSalesOrder = asyncHandler(async (req, res) => {
  const found = await findOrder(req.params.id);
  // Delete only if the status hasn't changed under us, then restore stock when the order was holding some.
  const order = await SalesOrder.findOneAndDelete({ _id: found._id, status: found.status });
  if (!order) throw new HttpError(409, 'Order was just changed — refresh and try again');
  let rows = [];
  let movements = [];
  if (['Confirmed', 'Shipped', 'Delivered'].includes(order.status) && order.warehouse) {
    try {
      ({ rows, movements } = await restoreStock(order, req.user.name, `Deleted order ${order.orderNumber}`));
    } catch (error) {
      await SalesOrder.create(order.toObject());
      throw error;
    }
  }
  res.json({ message: 'Order deleted', movements: movements.map(movementDTO), stock: rows.map(stockRow) });
});
