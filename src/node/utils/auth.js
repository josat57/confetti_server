import jwt from 'jsonwebtoken';
import { logger } from './logger.js';
import crypto from 'crypto';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET) {
  logger.error('JWT access secret is not configured. Please set JWT_ACCESS_SECRET in your environment variables.');
  throw new Error('JWT access secret is not configured');
}

if (!JWT_REFRESH_SECRET) {
  logger.error('JWT refresh secret is not configured. Please set JWT_REFRESH_SECRET in your environment variables.');
  throw new Error('JWT refresh secret is not configured');
}

export const generateAccessToken = (user) => {
  try {
    return jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role
      },
      JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
};

export const generateRefreshToken = (user) => {
  try {
    return jwt.sign(
      { 
        id: user._id,
        tokenVersion: user.tokenVersion || 0
      },
      JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    logger.error('Error verifying access token:', error);
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    logger.error('Error verifying refresh token:', error);
    throw new Error('Invalid or expired refresh token');
  }
};

export const generateTokenPair = (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  return { accessToken, refreshToken };
};

export const generateRandomToken = () => {
  return crypto.randomBytes(40).toString('hex');
}; 