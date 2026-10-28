// Turns database documents into the exact JSON shape the React app reads (string ids, flat references).
const str = (v) => (v === null || v === undefined ? null : String(v));

export function movementDTO(m) {
  const o = m.toObject ? m.toObject() : m;
  return {
    id: str(o._id),
    type: o.type,
    productId: str(o.product),
    warehouseId: str(o.warehouse),
    fromWarehouseId: str(o.fromWarehouse),
    toWarehouseId: str(o.toWarehouse),
    qty: o.qty,
    user: o.user,
    note: o.note,
    date: o.createdAt,
  };
}

export function stockRow(stockDoc) {
  return { productId: str(stockDoc.product), warehouseId: str(stockDoc.warehouse), quantity: stockDoc.quantity };
}

const itemsDTO = (items) => items.map((i) => ({ productId: str(i.productId), qty: i.qty, price: i.price }));

export function salesOrderDTO(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: str(o._id),
    orderNumber: o.orderNumber,
    customer: o.customer,
    date: o.date,
    items: itemsDTO(o.items),
    total: o.total,
    status: o.status,
    warehouseId: str(o.warehouse),
    createdAt: o.createdAt,
  };
}

export function purchaseOrderDTO(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: str(o._id),
    poNumber: o.poNumber,
    supplierId: str(o.supplierId),
    date: o.date,
    items: itemsDTO(o.items),
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
  };
}

export function supplierDTO(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: str(o._id),
    name: o.name,
    contactPerson: o.contactPerson,
    email: o.email,
    phone: o.phone,
    address: o.address,
  };
}

export function userDTO(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return { id: str(o._id), name: o.name, email: o.email, role: o.role, avatar: o.avatar, active: o.active };
}

export function notificationDTO(doc, userId) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: str(o._id),
    type: o.type,
    title: o.title,
    message: o.message,
    date: o.date,
    read: (o.readBy || []).some((id) => String(id) === String(userId)),
  };
}
