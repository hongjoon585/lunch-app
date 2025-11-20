FROM node:18-alpine AS deps
WORKDIR /app

# 의존성 정의 파일만 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# ================================

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# non-root 유저 생성
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# deps 단계에서 설치한 node_modules만 복사
COPY --from=deps /app/node_modules ./node_modules

# 필요한 파일만 복사
COPY package*.json ./
COPY src ./src

# 권한 변경 후 앞으로는 nodejs 유저로 실행
RUN chown -R nodejs:nodejs /app
USER nodejs

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "src/server.js"]

