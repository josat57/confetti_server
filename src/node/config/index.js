import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 9000,
  
  jwt: {
    secret: process.env.JWT_ACCESS_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRES_IN || '1d'
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Validate required environment variables
  validate() {
    const required = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_ACCESS_EXPIRES_IN',
      'JWT_REFRESH_EXPIRES_IN',
      'REDIS_URL'
    ];
    
    for (const variable of required) {
        console.log(process.env[variable]);
      if (!process.env[variable]) {
        throw new Error(`Environment variable ${variable} is required`);
      }
    }
  }
};

// Validate configuration on startup
config.validate();

export default config; 