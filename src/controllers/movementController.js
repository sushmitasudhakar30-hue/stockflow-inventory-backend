import Movement from '../models/Movement.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { movementDTO, stockRow } from '../utils/serializers.js';
import { addStock, removeStock, recordMovements, validQty, ensureIds } from '../services/stockService.js';

function checkQty(qty) {
  if (!validQty(qty)) throw new HttpError(400, 'Quantity must be a positive integer');
}

// Every stock call answers { movement, stock: [{ productId, warehouseId, quantity }] } with the NEW quantities.
const respond = (res, movement, ...stockDocs) =>
  res.status(201).json({ movement: movementDTO(movement), stock: stockDocs.map(stockRow) });

export const stockIn = asyncHandler(async (req, res) => {
  const { productId, warehouseId, qty, note = '' } = req.body;
  checkQty(qty);
  await ensureIds(productId, [warehouseId]);
  const stock = await addStock(productId, warehouseId, qty);
  const [movement] = await recordMovements(
    [{ type: 'Stock In', product: productId, warehouse: warehouseId, qty, user: req.user.name, note }],
    () => removeStock(productId, warehouseId, qty)
  );
  respond(res, movement, stock);
});

export const stockOut = asyncHandler(async (req, res) => {
  const { productId, warehouseId, qty, note = '' } = req.body;
  checkQty(qty);
  await ensureIds(productId, [warehouseId]);
  const stock = await removeStock(productId, warehouseId, qty);
  const [movement] = await recordMovements(
    [{ type: 'Stock Out', product: productId, warehouse: warehouseId, qty, user: req.user.name, note }],
    () => addStock(productId, warehouseId, qty)
  );
  respond(res, movement, stock);
});

export const transferStock = asyncHandler(async (req, res) => {
  const { productId, fromWarehouseId, toWarehouseId, qty, note = '' } = req.body;
  if (fromWarehouseId === toWarehouseId) {
    throw new HttpError(400, 'Source and destination warehouses must be different');
  }
  checkQty(qty);
  await ensureIds(productId, [fromWarehouseId, toWarehouseId]);

  // Debit source first (fails cleanly if insufficient). If the credit fails, refund the source.
  const from = await removeStock(productId, fromWarehouseId, qty);
  let to;
  try {
    to = await addStock(productId, toWarehouseId, qty);
  } catch (error) {
    await addStock(productId, fromWarehouseId, qty);
    throw error;
  }
  const [movement] = await recordMovements(
    [
      {
        type: 'Transfer',
        product: productId,
        fromWarehouse: fromWarehouseId,
        toWarehouse: toWarehouseId,
        qty,
        user: req.user.name,
        note,
      },
    ],
    async () => {
      await removeStock(productId, toWarehouseId, qty);
      await addStock(productId, fromWarehouseId, qty);
    }
  );
  respond(res, movement, from, to);
});

export const reportDamaged = asyncHandler(async (req, res) => {
  const { productId, warehouseId, qty, reason = '' } = req.body;
  checkQty(qty);
  await ensureIds(productId, [warehouseId]);
  const stock = await removeStock(productId, warehouseId, qty);
  const [movement] = await recordMovements(
    [{ type: 'Damaged', product: productId, warehouse: warehouseId, qty, user: req.user.name, note: reason }],
    () => addStock(productId, warehouseId, qty)
  );
  respond(res, movement, stock);
});

export const getMovements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.productId) filter.product = req.query.productId;
  if (req.query.warehouseId) {
    filter.$or = [
      { warehouse: req.query.warehouseId },
      { fromWarehouse: req.query.warehouseId },
      { toWarehouse: req.query.warehouseId },
    ];
  }
  const movements = await Movement.find(filter).sort({ createdAt: -1 });
  res.json(movements.map(movementDTO));
});
