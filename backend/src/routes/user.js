import { Router } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.get('/', requireAuth, async (req, res) => {
  const u = await User.findById(req.user.uid).select('email role');
  res.json({ user: u });
});

export default router;

