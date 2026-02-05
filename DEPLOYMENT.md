# DrawNGuess Deployment Guide

This guide provides instructions for deploying the **DrawNGuess** application using Docker. It covers configuration, build steps, and production considerations.

## Prerequisites

- **Docker** and **Docker Compose** installed on the host machine.
- A valid domain name (recommended for production) or static IP.
- SSL Certificates (if deploying to the public internet, highly recommended).

## Docker Deployment (Recommended)

The project includes a multi-stage `Dockerfile` that builds both the React client and the Node.js/Socket.IO server into a single lightweight image.

### 1. Environment Configuration

Create a `.env.production` file (or set these as CI/CD secrets/Docker environment variables).

**Required Variables:**

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | **Build-time only.** The public URL of your server. Used by the React client to connect to the Socket.IO server. | `https://play.yourdomain.com` or `http://your-ip:3000` |
| `CORS_ORIGIN` | **Runtime only.** Comma-separated list of allowed origins. **CRITICAL:** This must be the **CLIENT's URL** (where users visit), not the server's API URL. | `https://draw.yourdomain.com,https://another-client.com` |
| `PORT` | **Runtime only.** Port the server listens on inside the container. | `3000` (Default) |
| `NODE_ENV` | runtime environment. | `production` |

### 2. Build the Image

**Critical:** You must pass `VITE_API_URL` as a build argument because Vite embeds environment variables into the static JavaScript bundle at build time.

```bash
docker build \
  --build-arg VITE_API_URL=https://play.yourdomain.com \
  -t drawnguess:latest .
```

### 3. VITE_API_URL Handling
- **Development/Local**: Defaults to `import.meta.env.VITE_API_URL` (if set) or assumes same-origin connection if unset.
- **Docker Production**: The default behavior is now to use **same-origin (relative path)** connection. This is generally preferred for containerized deployments where Nginx/Express serves both client and API.
  - If you need to point to a *different* API domain (e.g. separate backend hosting), pass it as a build arg:
    ```bash
    docker build --build-arg VITE_API_URL=https://my-api.com -t my-app .
    ```

### 4. Run the Container

Running locally or with a simple script:

```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e CORS_ORIGIN=https://play.yourdomain.com \
  --name drawnguess \
  drawnguess:latest
```

### 4. Docker Compose Example

For 1-click deployment, create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  drawnguess:
    build:
      context: .
      args:
        VITE_API_URL: https://play.yourdomain.com # CHANGE THIS
    image: drawnguess:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - CORS_ORIGIN=https://play.yourdomain.com # CHANGE THIS
    restart: always
```

## Production Considerations

### ⚠️ In-Memory State & Scale
**Current Limits:**
The application currently uses **In-Memory State**.
- **Data Persistence:** If the container restarts or crashes, **ALL active rooms and games are lost immediately.**
- **Scaling:** You **cannot** allow horizontal scaling (multiple instances) out of the box. Players connected to Instance A cannot play with players on Instance B.
- **Recommendation:** Run a single stable instance. For multi-instance scaling, you must implement the Redis Adapter for Socket.IO and move state management to an external store (Redis/DB).

### 🔒 CORS & Security
- **Strict CORS:** Ensure `CORS_ORIGIN` is set correctly. If omitted in production, the server will intentionally fail to start to prevent security risks.
- **HTTPS:** Browsers require HTTPS for many modern features (Clipboard API, Service Workers). Run this container behind a reverse proxy like **Nginx** or **Traefik** that handles SSL termination.

### HEALTHCHECK
The Dockerfile includes a healthcheck that pings `http://localhost:3000`. Container orchestrators (Kubernetes, AWS ECS, Docker Swarm) can use this to auto-restart unhealthy containers.

## Troubleshooting

**Game disconnects immediately:**
- Check server logs: `docker logs drawnguess`
- Verify `CORS_ORIGIN` matches the browser URL exactly.
- Ensure WebSocket connection (ws/wss) is allowed by your proxy/firewall.

**Client cannot connect (Socket Error):**
- Did you set `VITE_API_URL` during the **build** phase?
- If you change the domain, you **MUST rebuild the image**. You cannot change the client's socket URL at runtime.

**"Invalid Settings" or Validation Errors:**
- Check the server logs for Zod validation errors. This usually means a client/server version mismatch if you updated one but not the other.
