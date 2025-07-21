# Docker Setup Guide

This application is fully containerized with Docker for easy deployment and development.

## Prerequisites

- Docker and Docker Compose installed
- GEMINI_API_KEY in your .env file

## Quick Start - Hybrid Development (Recommended)

The hybrid approach runs PocketBase in Docker while your app runs locally. This gives you the best development experience with full debugging capabilities and instant hot-reload.

### 1. Start with One Command

```bash
# Start PocketBase in Docker AND run the app locally
pnpm run dev:hybrid
```

Or manually:

```bash
# Terminal 1: Start PocketBase in Docker
pnpm run db:start

# Terminal 2: Run your app locally
pnpm run dev
```

This will:

- **PocketBase** (in Docker) on http://localhost:8090
- **Application** (local) on http://localhost:5173

### 2. Manage PocketBase

```bash
# View PocketBase logs
pnpm run db:logs

# Restart PocketBase
pnpm run db:restart

# Stop PocketBase
pnpm run db:stop
```

### Benefits of Hybrid Approach

✅ **Full debugging** - Use VS Code debugger, breakpoints work normally  
✅ **Instant hot-reload** - Changes reflect immediately, no Docker overhead  
✅ **Better performance** - No virtualization layer for your app  
✅ **Easy PocketBase management** - Database runs isolated in Docker  
✅ **Same database as production** - Consistent environment

## Quick Start - Full Docker

If you prefer running everything in Docker:

### 1. Start Everything with Docker Compose

```bash
# Start all services (PocketBase + App)
pnpm run docker:up

# Or build and start
pnpm run docker:up:build
```

This will start:

- **PocketBase** on http://localhost:8090
- **Application** on http://localhost:5173

### 2. View Logs

```bash
# View all logs
pnpm run docker:logs

# View only app logs
pnpm run docker:logs:app

# View only PocketBase logs
pnpm run docker:logs:pb
```

### 3. Stop Services

```bash
# Stop all services
pnpm run docker:down

# Stop and remove all data
pnpm run docker:clean
```

## Docker Commands

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `pnpm run docker:build`      | Build the development Docker image  |
| `pnpm run docker:build:prod` | Build the production Docker image   |
| `pnpm run docker:up`         | Start all services in detached mode |
| `pnpm run docker:up:build`   | Build and start all services        |
| `pnpm run docker:down`       | Stop all services                   |
| `pnpm run docker:logs`       | View logs from all services         |
| `pnpm run docker:logs:app`   | View only app logs                  |
| `pnpm run docker:logs:pb`    | View only PocketBase logs           |
| `pnpm run docker:clean`      | Stop services and remove volumes    |
| `pnpm run docker:prod`       | Start production build              |
| `pnpm run db:start`          | Start only PocketBase (hybrid dev)  |
| `pnpm run db:stop`           | Stop PocketBase                     |
| `pnpm run db:logs`           | View PocketBase logs                |
| `pnpm run db:restart`        | Restart PocketBase                  |
| `pnpm run dev:hybrid`        | Start PocketBase + run app locally  |

## Environment Variables

### For Hybrid Development

Use `.env` or `.env.development`:

```env
# Required
GEMINI_API_KEY=your-gemini-api-key

# PocketBase URLs for hybrid development
# App runs locally, PocketBase in Docker
POCKETBASE_URL=http://localhost:8090
POCKETBASE_URL=http://localhost:8090

# Optional
NODE_ENV=development
POCKETBASE_ADMIN_EMAIL=admin@pocketbase.com
POCKETBASE_ADMIN_PASSWORD=zuFLRXYqqzhfszPVfYwNeUf
```

### For Full Docker Development

```env
# Required
GEMINI_API_KEY=your-gemini-api-key

# PocketBase URLs for Docker-to-Docker communication
POCKETBASE_URL=http://localhost:8090
POCKETBASE_URL=http://pocketbase:8090

# Optional (defaults shown)
NODE_ENV=development
POCKETBASE_ADMIN_EMAIL=admin@pocketbase.com
POCKETBASE_ADMIN_PASSWORD=zuFLRXYqqzhfszPVfYwNeUf
```

## Volumes

The following directories are mounted as volumes:

- `./uploads` - For uploaded PPTX files
- `./output` - For analysis results
- `./temp` - For temporary files
- `./logs` - For application logs
- `./pb_data` - PocketBase data
- `./pb_migrations` - PocketBase migrations

## Production Deployment

For production:

```bash
# Build production image
pnpm run docker:build:prod

# Start production services
pnpm run docker:prod
```

The production build:

- Runs on port 3000
- Uses optimized Node.js build
- Includes health checks
- Runs with production environment

## Troubleshooting

### LibreOffice Issues

The Docker image includes LibreOffice for PDF conversion. If you see conversion errors, the container might need more memory.

### PocketBase Connection

If the app can't connect to PocketBase, ensure:

1. PocketBase is healthy: `docker-compose ps`
2. Both services are on the same network
3. Using correct URL: `http://pocketbase:8090` (internal)

### Permission Issues

If you encounter permission issues with volumes:

```bash
# Fix permissions
chmod -R 755 uploads output temp logs pb_data
```

## Development Tips

1. **Hot Reload**: The development container supports hot reload. Changes to your code will automatically reflect.

2. **Database Access**: Access PocketBase admin at http://localhost:8090/\_/

3. **Debugging**: Use `docker-compose logs -f app` to see real-time logs

4. **Shell Access**:
   ```bash
   docker-compose exec app sh
   ```

## Architecture

- **app**: SvelteKit application with LibreOffice for document processing
- **pocketbase**: Database and backend API
- **Network**: Both services communicate on internal Docker network
