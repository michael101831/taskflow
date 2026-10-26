FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

# Schema parsing requires this name at build time. Railway replaces it at runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "run", "start:prod"]
