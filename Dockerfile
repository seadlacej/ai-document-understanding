# Use Node.js 20 Alpine for smaller image size
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

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create required directories
RUN mkdir -p uploads output temp logs && \
    chmod 755 uploads output temp logs

# Set environment variables for LibreOffice
ENV HOME=/tmp
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Expose port if needed (adjust based on your app)
# EXPOSE 3000

# No default CMD - will be specified at runtime