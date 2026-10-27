import { HttpError } from '../utils/errors.js';

export const notFound = (req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'That value already exists' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}
