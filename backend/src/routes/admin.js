import { Router } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Search from '../models/Search.js';
import Recommendation from '../models/Recommendation.js';

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
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// 전체 검색 기록 조회(간단)
router.get('/logs', requireAuth, requireAdmin, async (req, res) => {
  const items = await Search.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

// 단건 삭제(연관 추천도 제거)
router.delete('/logs/:searchId', requireAuth, requireAdmin, async (req, res) => {
  const { searchId } = req.params;
  await Recommendation.deleteOne({ searchId });
  const r = await Search.deleteOne({ _id: searchId });
  res.json({ deleted: r.deletedCount });
});

export default router;

