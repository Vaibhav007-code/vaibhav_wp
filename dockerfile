FROM node:18-bullseye-slim

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY backend/ ./

# Expose port
EXPOSE 5000

# Start application
CMD ["node", "server.js"]
```

**Replace your entire Dockerfile with the above code** (no backticks, no markdown).

Also create `.dockerignore` in project root:
```
node_modules
npm-debug.log
.env
.git
.gitignore
frontend
.wwebjs_auth
*.db
README.md
.DS_Store
