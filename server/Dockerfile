FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

COPY src ./src
COPY tsconfig.json ./

EXPOSE 4400
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
