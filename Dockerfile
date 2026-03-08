# Multi-stage Dockerfile for NYC Explorer on Google Cloud Run
# Builds both frontend (Next.js) and backend (FastAPI) with nginx reverse proxy

# ============================================
# Stage 1: Build the Next.js frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Set the backend URL for Next.js rewrites (internal container communication)
ENV BACKEND_URL="http://localhost:8000"

# Build the Next.js app
RUN npm run build

# ============================================
# Stage 2: Production image with Python + Node + Nginx
# ============================================
FROM python:3.11-slim

# Install Node.js and nginx
RUN apt-get update && apt-get install -y \
    curl \
    nginx \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the root config.py (contains API keys)
COPY config.py ./

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Create nginx configuration for reverse proxy
RUN echo 'server {\n\
    listen 8080;\n\
    server_name _;\n\
\n\
    # WebSocket support\n\
    proxy_http_version 1.1;\n\
    proxy_set_header Upgrade $http_upgrade;\n\
    proxy_set_header Connection "upgrade";\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    proxy_set_header X-Forwarded-Proto $scheme;\n\
\n\
    # API routes to FastAPI backend\n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:8000;\n\
    }\n\
\n\
    # WebSocket route to FastAPI backend\n\
    location /ws/ {\n\
        proxy_pass http://127.0.0.1:8000;\n\
        proxy_read_timeout 3600s;\n\
        proxy_send_timeout 3600s;\n\
    }\n\
\n\
    # All other routes to Next.js frontend\n\
    location / {\n\
        proxy_pass http://127.0.0.1:3000;\n\
    }\n\
}\n\
' > /etc/nginx/sites-available/default

# Create supervisord configuration to run all services
RUN echo '[supervisord]\n\
nodaemon=true\n\
user=root\n\
\n\
[program:nginx]\n\
command=/usr/sbin/nginx -g "daemon off;"\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:backend]\n\
command=uvicorn main:app --host 127.0.0.1 --port 8000\n\
directory=/app/backend\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:frontend]\n\
command=npm start -- -p 3000\n\
directory=/app/frontend\n\
autostart=true\n\
autorestart=true\n\
environment=BACKEND_URL="http://127.0.0.1:8000"\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
' > /etc/supervisor/conf.d/app.conf

# Cloud Run uses PORT env variable (default 8080)
ENV PORT=8080

# Expose the main port
EXPOSE 8080

# Run supervisord to manage all services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
