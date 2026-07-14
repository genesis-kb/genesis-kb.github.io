/**
 * Application Configuration
 * Centralizes all environment variables and configuration settings
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

// Check if .env file exists and load it
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    // Use console here since logger depends on config
    console.error('[Config] Error loading .env file');
  }
} else {
  // Fallback: try loading from current working directory
  dotenv.config();
}

/**
 * Validates that required environment variables are set
 * @param {string[]} requiredVars - Array of required variable names
 * @throws {Error} If any required variable is missing
 */
const validateEnvVars = (requiredVars) => {
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
};

// Validate critical environment variables
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

// Only validate in production, allow fallbacks in development
if (process.env.NODE_ENV === 'production') {
  validateEnvVars(requiredVars);
}

/**
 * Configuration object
 */
const config = {
  // Server settings
  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
  },

  // Database configuration (AWS RDS PostgreSQL)
  database: {
    url: process.env.DATABASE_URL || '',
    rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED !== 'false',
  },

  // Authentication (JWT)
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: 12,
  },

  // Gemini AI configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    models: {
      chat: 'gemini-3-flash-preview',
      tts: 'gemini-2.5-flash-preview-tts',
    },
    tts: {
      voice: 'Kore',
      maxTextLength: 2000,
    },
    context: {
      maxTranscriptLength: 25000,
    },
  },

  // CORS configuration
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
    credentials: true,
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    // Stricter limits for AI endpoints
    ai: {
      windowMs: 60000, // 1 minute
      maxRequests: 20, // 20 AI requests per minute
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
