FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* 변수는 빌드 타임에 번들에 인라인됨.
# xquare는 Vault KV를 --secret id=vault_env 로 주입하므로 빌드 직전 source 해서 export.
RUN --mount=type=secret,id=vault_env \
    if [ -f /run/secrets/vault_env ]; then set -a; . /run/secrets/vault_env; set +a; fi && \
    npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
