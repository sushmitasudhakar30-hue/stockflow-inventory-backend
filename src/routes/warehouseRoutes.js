import { Router } from 'express';
import { getWarehouses, getWarehouse, createWarehouse, addLocation } from '../controllers/warehouseController.js';
const router = Router();
router.get('/', getWarehouses);
router.get('/:id', getWarehouse);
router.post('/', createWarehouse);
router.post('/:id/locations', addLocation);
export default router;
