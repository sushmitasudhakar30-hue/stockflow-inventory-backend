export function getStockStatus(total, reorderLevel) {
  if (total === 0) return 'Out of Stock';
  if (total <= reorderLevel) return 'Low Stock';
  return 'Normal';
}
