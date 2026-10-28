import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { userDTO } from '../utils/serializers.js';

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password so accounts can't be probed.
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new HttpError(401, 'Invalid email or password');
  if (!user.active) throw new HttpError(403, 'This account has been deactivated. Contact an administrator');
  res.json({ token: signToken(user), user: userDTO(user) });
});

export const me = (req, res) => res.json({ user: userDTO(req.user) });
