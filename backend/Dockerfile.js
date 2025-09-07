# backend/Dockerfile
FROM node:18-alpine

# Install dependencies for bcrypt and other native modules
RUN apk add --no-cache python3 make g++ && \
    ln -sf python3 /usr/bin/python

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm rebuild bcrypt --build-from-source

# Copy app source
COPY . .

# Create necessary directories
RUN mkdir -p public/uploads temp logs backups

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Start the app
CMD ["node", "server.js"]
