import 'dotenv/config';
// import './models/index.js';  // This will register all models
import app from './app.js';
import { connectDB } from './config/database.js';
import http from 'http';
import NotificationManagerService from './services/notification/manager.service.js';
import MessageService from './services/messaging/message.service.js';
import config from './config/index.js';
import logger from './services/logging/advanced.service.js';

// Debug environment variables
console.log('Environment Variables:', {
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
});

const PORT = config.port;

// Import models
// import './models/trip.model.js';
// import './models/expense.model.js';

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await connectDB();
        logger.info('Database connected successfully');

        // Start server
        const server = http.createServer(app);

        // Attach WebSocket upgrade handler
        // server.js
        server.on('upgrade', (request, socket, head) => {
        // Log the upgrade request for debugging
            console.log('WebSocket upgrade request:', {
                url: request.url,
                headers: request.headers,
                pathname: new URL(request.url, `http://${request.headers.host}`).pathname        
            });

            const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

            if (pathname === '/ws/notifications') {
                NotificationManagerService.wss.handleUpgrade(request, socket, head, (ws) => {
                    NotificationManagerService.wss.emit('connection', ws, request);
                });
            } else if (pathname === '/ws/messages') {
                MessageService.wss.handleUpgrade(request, socket, head, (ws) => {
                    MessageService.wss.emit('connection', ws, request);
                });
            } else {
                console.log('Invalid WebSocket path:', pathname);
                socket.destroy();
            }
        });

        const serverListening = server.listen(PORT, () => {
            console.log(`
                🚀 Server running on port ${PORT}
                🌐 Health check: http://localhost:${PORT}/health
                ⏰ Time: ${new Date().toISOString()}
            `);
        });

        // Handle unhandled rejections
        process.on('unhandledRejection', (error) => {
          logger.error('Unhandled Rejection:', error);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
          logger.error('Uncaught Exception:', error);
        });

        return serverListening;

    } catch (error) {
        logger.error('Server startup error:', error);
        process.exit(1);
    }
};
console.log("Start a sign here...", startServer);
startServer();

export default app;