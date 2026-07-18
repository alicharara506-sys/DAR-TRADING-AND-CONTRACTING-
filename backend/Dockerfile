# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
# Prisma's query/schema engines need OpenSSL; node:22-alpine ships without it,
# which makes Prisma silently fail to detect libssl and crash at runtime.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
# Pinned to the exact versions in package.json's devDependencies: an
# unpinned `npm i -g ts-node typescript` can install two versions that are
# incompatible with each other (ts-node reading internals typescript no
# longer exposes the same way), crashing with
# "Cannot read properties of undefined (reading 'fileExists')".
RUN npm i -g prisma@5.22.0 ts-node@10.9.2 typescript@5.9.3 @types/node@22.10.2 && mkdir -p uploads
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
