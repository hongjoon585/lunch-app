import { Router } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Audit from '../models/AuditLog.js';

dotenv.config();
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// 초기 admin 시드(서버 스타트 후 첫 로그인 시 사용자가 없으면 생성)
async function ensureAdminSeed() {
  const { ADMIN_EMAIL, ADMIN_PASS } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASS) return;
  const exists = await User.findOne({ email: ADMIN_EMAIL });
  if (!exists) {
    const passwordHash = await bcrypt.hash(ADMIN_PASS, 11);
    await User.create({ email: ADMIN_EMAIL, passwordHash, role: 'admin' });
    console.log('[back] Admin seeded:', ADMIN_EMAIL);
  }
}
ensureAdminSeed().catch(console.error);

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '이메일/비밀번호 필요' });
    const dup = await User.findOne({ email });
    if (dup) return res.status(409).json({ error: '이미 존재하는 이메일' });

    const passwordHash = await bcrypt.hash(password, 11);
    const user = await User.create({ email, passwordHash, role: 'user' });
    await Audit.create({ actorId: user._id, action: 'REGISTER' });
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: '계정이 없습니다' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: '비밀번호 오류' });

    const token = jwt.sign({ uid: user._id.toString(), role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
    await Audit.create({ actorId: user._id, action: 'LOGIN' });
    return res.json({ token, user: { email: user.email, role: user.role } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;

