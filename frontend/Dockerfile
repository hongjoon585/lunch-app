FROM node:18-alpine

# 앱 실행 디렉터리
WORKDIR /app

# 현재 디렉터리의 모든 파일을 컨테이너 /app 으로 복사
COPY . .

# 컨테이너가 뜰 때 실행할 명령
CMD ["node", "app.js"]
