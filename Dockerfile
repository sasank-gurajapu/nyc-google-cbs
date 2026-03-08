# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx template — $PORT is substituted at container start by Cloud Run
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run sets PORT (default 8080); nginx/templates/ auto-substitutes via envsubst
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
