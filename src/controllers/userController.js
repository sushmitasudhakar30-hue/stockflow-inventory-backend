import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ROLES } from '../utils/roles.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { userDTO } from '../utils/serializers.js';

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function checkRole(role) {
  if (role !== undefined && !ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
}

const duplicateEmail = (error) => {
  if (error.code === 11000) throw new HttpError(409, 'A user with this email already exists');
  throw error;
};

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json(users.map(userDTO));
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'Inventory Staff' } = req.body;
  if (!name?.trim() || !email?.trim()) throw new HttpError(400, 'Name and email are required');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  checkRole(role);
  try {
    const user = await User.create({
      name,
      email,
      role,
      avatar: req.body.avatar || initials(name),
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json(userDTO(user));
  } catch (error) {
    duplicateEmail(error);
  }
});

export const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;
  checkRole(role);
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (String(user._id) === String(req.user._id) && role && role !== user.role) {
    throw new HttpError(400, "You can't change your own role");
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (password) {
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  try {
    await user.save();
  } catch (error) {
    duplicateEmail(error);
  }
  res.json(userDTO(user));
});

export const toggleActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (String(user._id) === String(req.user._id)) throw new HttpError(400, "You can't deactivate your own account");
  user.active = !user.active;
  await user.save();
  res.json(userDTO(user));
});
