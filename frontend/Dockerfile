# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
# next.config.mjs's rewrites() is resolved once during `next build` and baked
# into the routes manifest — it is NOT re-read from the environment at
# container start. The API's internal address must therefore be supplied as a
# build argument, not just a runtime environment variable.
ARG API_INTERNAL_URL=http://localhost:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY package*.json ./
RUN npm ci
COPY . .
# Guard against an empty/missing public/ dir (e.g. lost by tools that don't track empty folders)
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime stage (standalone output) ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3000/en/login >/dev/null || exit 1
CMD ["node", "server.js"]
