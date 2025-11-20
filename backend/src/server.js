//test
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// DB 연결
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('[back] Mongo connected'))
  .catch(err => console.error('[back] Mongo error:', err.message));

// 헬스
app.get('/healthz', (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).send(ok ? 'ok' : 'not ready');
});

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/me', userRoutes);
app.use('/api', searchRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((req,res) => res.status(404).json({error:'Not Found'}));

app.listen(PORT, () => console.log(`[back] listening on ${PORT}`));

