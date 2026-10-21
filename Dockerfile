FROM node:22-alpine AS builder

WORKDIR /app

# Copy backend package files and prisma schema
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies and generate prisma client
RUN npm install
RUN npx prisma generate

# Copy backend source code and build
COPY backend/ .
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy package files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev
RUN npx prisma generate

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Create uploads folder
RUN mkdir -p uploads

EXPOSE 10000

CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
