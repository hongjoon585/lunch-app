import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ 백엔드 베이스 URL 우선순위:
// 1) API_BASE_URL (k8s에서 주입)
// 2) BACKEND_BASE_URL (혹시 나중에 쓸 수 있게 남겨둠)
// 3) BACKEND_API_HOST (ConfigMap key 이름)
// 4) 마지막 디폴트: 쿠버네티스 서비스 FQDN
const BACKEND =
  process.env.API_BASE_URL ||
  process.env.BACKEND_BASE_URL ||
  process.env.BACKEND_API_HOST ||
  'http://lunch-app-back-service.back-ns:4000';

const JWT_SECRET = process.env.JWT_SECRET;

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// 헬스
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// 유저 파싱 미들웨어
function parseUser(req, _res, next) {
  const token = req.cookies?.token;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}
app.use(parseUser);

// 권한
function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).render('error', { code: 403, message: 'Forbidden' });
  next();
}

// 메인
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// 로그인
app.get('/auth/login', (req, res) => {
  res.render('auth/login', { next: req.query.next || '/' });
});
app.post('/auth/login', async (req, res) => {
  const r = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).render('auth/login', { error: data.error || '로그인 실패', next: req.body.next || '/' });
  res.cookie('token', data.token, { httpOnly: true }); // demo
  return res.redirect('/');
});

// 회원가입
app.get('/auth/register', (req, res) => res.render('auth/register'));
app.post('/auth/register', async (req, res) => {
  const r = await fetch(`${BACKEND}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  if (!r.ok) {
    const data = await r.json().catch(()=>({}));
    return res.status(r.status).render('auth/register', { error: data.error || '회원가입 실패' });
  }
  return res.redirect('/auth/login?registered=1');
});

// 로그아웃
app.post('/auth/logout', (req,res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// 사용자 검색
app.get('/search', requireAuth, (req, res) => {
  res.render('search/form', { user: req.user });
});
app.post('/search', requireAuth, async (req, res) => {
  const r = await fetch(`${BACKEND}/api/searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${req.cookies.token}` },
    body: JSON.stringify(req.body)
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).render('search/form', { user: req.user, error: data.error || '추천 실패' });
  return res.redirect(`/results/${data.id}`);
});

// 결과/히스토리
app.get('/results/:id', requireAuth, async (req, res) => {
  const r = await fetch(`${BACKEND}/api/results/${req.params.id}`, {
    headers: { authorization: `Bearer ${req.cookies.token}` }
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).render('error', { code: r.status, message: data.error || '결과 없음' });
  res.render('search/detail', { user: req.user, result: data.result, search: data.search });
});

app.get('/history', requireAuth, async (req, res) => {
  const r = await fetch(`${BACKEND}/api/searches`, {
    headers: { authorization: `Bearer ${req.cookies.token}` }
  });
  const data = await r.json();
  res.render('search/history', { user: req.user, items: data.items || [] });
});

// 관리자
app.get('/admin', requireAuth, requireAdmin, async (req,res) => {
  const r = await fetch(`${BACKEND}/api/admin/logs`, {
    headers: { authorization: `Bearer ${req.cookies.token}` }
  });
  const data = await r.json();
  res.render('admin/dashboard', { user: req.user, items: data.items || [] });
});

app.post('/admin/logs/:searchId/delete', requireAuth, requireAdmin, async (req,res) => {
  const r = await fetch(`${BACKEND}/api/admin/logs/${req.params.searchId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${req.cookies.token}` }
  });
  // 결과 무시하고 리다이렉트
  res.redirect('/admin');
});

// 404
app.use((req,res) => res.status(404).render('error', { code: 404, message: '페이지가 없어요' }));

app.listen(PORT, () => console.log(`[front] listening on ${PORT}`));

