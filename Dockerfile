FROM node:22-alpine

# better-sqlite3 compiles a native module against musl on alpine
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client into app/generated/prisma, then build Next.js
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# On start: apply migrations, seed once if empty, then run the server
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed-if-empty.mjs && npm run start"]
