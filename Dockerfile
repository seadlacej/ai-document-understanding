# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Install LibreOffice and required dependencies
RUN apk update && apk add --no-cache \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-draw \
    libreoffice-math \
    libreoffice-base \
    font-noto \
    font-noto-cjk \
    font-noto-extra \
    ttf-dejavu \
    ttf-liberation \
    ttf-freefont \
    fontconfig \
    dbus-x11 \
    cups-libs \
    python3 \
    py3-pip \
    imagemagick \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Set up fonts
RUN fc-cache -f -v

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/.svelte-kit ./.svelte-kit

# Copy other necessary files
COPY static ./static
COPY src ./src

# Create required directories
RUN mkdir -p uploads output temp logs pb_data pb_migrations && \
    chmod 755 uploads output temp logs pb_data pb_migrations

# Set environment variables
ENV HOME=/tmp
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run the application
CMD ["node", "build"]