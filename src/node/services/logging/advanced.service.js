import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: 'logs/combined.log'
        })
    ],
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: 'logs/exceptions.log'
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: 'logs/rejections.log'
        })
    ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Add stream for Morgan
logger.stream = {
    write: (message) => logger.info(message.trim())
};

export default logger; 