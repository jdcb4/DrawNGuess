# DrawNGuess

A production-ready, clone-able multiplayer **Telestrations-style** game using **React**, **Node.js**, **Socket.io**, and **Docker**.

## 🚀 Quick Start

1.  **Clone & Install**
    ```bash
    git clone <repo>
    npm install
    cd server && npm install
    cd ..
    ```

2.  **Environment**
    ```bash
    cp .env.example .env
    ```
    (Adjust `.env` if needed, defaults are fine for local dev)

3.  **Run Development**
    ```bash
    npm run dev
    ```
    - Frontend: http://localhost:5173
    - Backend: http://localhost:3000

## 🛠️ Cloning for a New Game

1.  **Duplicate Repo**: Clone this base into your new project folder.
2.  **Rename**: Update `appConfig.appName` in `shared/config.ts`.
3.  **Theme**: Adjust colors in `shared/config.ts` (Primary, Background, etc.).
4.  **Game Logic**:
    -   **State**: Define your game-specific data in `WordItem` or extend `GameState` in `shared/types`.
    -   **Server**: Implement game specific events (e.g. `submit_word`, `next_phase`) in `server/index.ts`.
    -   **Client**: Build your game UI in `src/pages/Game.tsx` utilizing the `room.gameState` object.

## 📦 Architecture

- **/shared**: Types, Config, & Events shared between Client/Server.
- **/server**: Node.js Express + Socket.io.
    - **/handlers**: Modular event handlers (Room, Game, Team).
    - **/state**: In-memory `RoomManager`.
- **/src**: React 19 + TypeScript Client.
- **/components/ui**: Reusable UI kit (Modal, Toast, Button).

## 🐳 Docker Deployment

### Quick Build & Run

```bash
# Build the image
docker build -t your-repo/drawnguess:0.1 .

# Run with environment variables
docker run -d \
  --name drawnguess \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e CORS_ORIGIN=https://draw.jboxtv.com \
  -e VITE_API_URL=https://draw.jboxtv.com \
  your-repo/drawnguess:0.1
```

> [!IMPORTANT]
> See [Docker Deployment Guide](./consultants/docker_deployment_guide.md) for full instructions, including Railway/Render deployment and production configuration.

### Environment Variables for Production

- `NODE_ENV=production` - **Required**
- `PORT=3000` - Default port
- `CORS_ORIGIN` - **Required** (e.g., `https://draw.jboxtv.com`)
- `VITE_API_URL` - **Required** for client build (e.g., `https://draw.jboxtv.com`)

## 🔒 Security & Env

- **CORS**: Configured via `CORS_ORIGIN` in `.env`.
- **Validation**: Socket events validated with Zod schemas.
- **Port**: Configurable via `PORT`.

## ✨ Features

-   **Real-time Multiplayer**: Socket.io powered synchronized state.
-   **Draw & Guess**: Full canvas drawing tools and word guessing phases.
-   **Auto-Submit**: Turns automatically submit when the timer expires.
-   **Reconnection**: Players can refresh or disconnect and rejoin their exact spot in the game.
-   **Image Sharing**: Generate a shareable image strip of your game's hilarious progression.
-   **Mobile Polish**: Swipe gestures, safe-area support, and responsive layouts.
-   **Robust Theming**: Full control over colors and radius via `shared/config.ts`.
-   **Production Ready**: Docker support, Zod validation, and TypeScript architecture.

## 🤝 Contributing

1.  Fork & Branch
2.  Make changes
3.  Submit PR

## 📝 Deployment Notes

### Single-Instance Design
This application uses **in-memory state** and is designed for **single-instance deployment**. Multi-instance/horizontal scaling is **not supported** without additional infrastructure (e.g., Redis adapter for Socket.IO rooms).

**Recommended Hosting:**
- Railway, Render, Fly.io (single container)
- Self-hosted VPS (single process)
- Docker deployment (see above)

### Security Checklist
Before deploying to production:
- ✅ Set `CORS_ORIGIN` in `.env` (server will fail-fast if missing in production)
- ✅ Set `NODE_ENV=production` in environment
- ✅ Rate limiting is enabled by default (100 req/15min per IP, 50 events per socket)
- ✅ Run `npm run build` in `/server` to verify TypeScript compilation

### Performance Limits
- **Concurrent rooms**: ~100-200 rooms per instance (depends on your server resources)
- **Players per room**: Tested up to 12 players
- **Socket connections**: Limited by rate limiting (50 events per connection)
