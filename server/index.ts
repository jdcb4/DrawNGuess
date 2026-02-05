import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load from root

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SOCKET_EVENTS } from '../shared/events';
import { SERVER_CONFIG } from '../shared/config';
import { registerRoomHandlers } from './handlers/roomHandler';
import { registerGameHandlers } from './handlers/gameHandler';
import { registerTeamHandlers } from './handlers/teamHandler';

const app = express();

// Security headers middleware (Helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false // Required for data: URLs in canvas
}));

// Rate limiting middleware (security against DoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: SERVER_CONFIG.rateLimits.httpRequestsPerWindow,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);


// CORS Configuration with production validation
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').filter(Boolean);

if (!allowedOrigins || allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ CORS_ORIGIN not set in production! Server will not start.');
        process.exit(1);
    }
    console.warn('⚠️  CORS_ORIGIN not set, using default localhost origins');
}

app.use(cors({
    origin: allowedOrigins || ['http://localhost:5173'],
    methods: ["GET", "POST"]
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    const clientDistPath = path.join(__dirname, '../../../client/dist');

    // Serve static files
    app.use(express.static(clientDistPath));

    // SPA fallback - serve index.html for all non-API routes
    // Use middleware instead of route to avoid Express 5 path-to-regexp issues
    app.use((req, res, next) => {
        // Only serve index.html for GET requests
        if (req.method === 'GET') {
            res.sendFile(path.join(clientDistPath, 'index.html'));
        } else {
            next();
        }
    });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins || ['http://localhost:5173'],
        methods: ["GET", "POST"]
    }
});

// Socket-level rate limiting to prevent event flooding
const socketEventCounts = new Map<string, number>();

io.on(SOCKET_EVENTS.CONNECT, (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Track events per socket
    socketEventCounts.set(socket.id, 0);

    // Rate limit middleware for all socket events
    socket.use(([event], next) => {
        const count = (socketEventCounts.get(socket.id) || 0) + 1;
        socketEventCounts.set(socket.id, count);

        if (count > SERVER_CONFIG.rateLimits.socketEventsPerConnection) {
            console.warn(`⚠️  Socket ${socket.id} exceeded rate limit, disconnecting`);
            socket.disconnect();
            return;
        }
        next();
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
        socketEventCounts.delete(socket.id);
    });

    // Register Handlers
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerTeamHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
if (!process.env.PORT) {
    console.warn('⚠️  PORT not set in .env, using default 3000');
}

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
