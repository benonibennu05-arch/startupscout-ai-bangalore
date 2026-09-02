# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* package-lock.json* ./

# Install all dependencies required for build
RUN npm install

# Copy source code and configuration
COPY . .

# Compile frontend (Vite) and backend bundle (esbuild)
RUN npm run build

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled distribution from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/index.html ./index.html

# Expose internal port
EXPOSE 3000

# Persistent storage volume for database and resumes
VOLUME ["/app/data"]

# Start the compiled Node.js backend
CMD ["npm", "start"]
