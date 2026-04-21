FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/backend/ ./src/backend/
COPY deploy-server.js ./

# Create .env template
RUN echo "LINEAR_API_KEY=your_linear_api_key_here" > .env.example
RUN echo "LINEAR_WEBHOOK_SECRET=your_webhook_secret_here" >> .env.example
RUN echo "PORT=3003" >> .env.example
RUN echo "NODE_ENV=production" >> .env.example

# Expose ports
EXPOSE 3003 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Start server
CMD ["node", "deploy-server.js"]