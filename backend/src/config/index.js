/**
 * Application Configuration
 * Centralizes all environment variables and configuration settings
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

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

// Validate critical environment variables.
// AI settings are deliberately not required: a missing or incomplete AI
// provider disables the AI endpoints via config.ai.enabled rather than
// stopping the server, so a deployment can run the rest of the API without one.
const requiredVars = ['DATABASE_URL'];

// Only validate in production, allow fallbacks in development
if (process.env.NODE_ENV === 'production') {
  validateEnvVars([...requiredVars, 'JWT_SECRET']);
} else {
  validateEnvVars(['JWT_SECRET']); // Always require JWT_SECRET to prevent forging
}

// Reject placeholder secrets in all environments
const invalidSecrets = ['your-jwt-secret-min-32-chars', 'dev-secret-change-in-production'];
if (invalidSecrets.includes(process.env.JWT_SECRET)) {
  throw new Error('JWT_SECRET must be changed from the default example values.');
}

/**
 * Decide whether a Gemini API key is usable.
 * The .env.example placeholder ('your-gemini-api-key-here') parses as a
 * perfectly good string, so a bare truthiness check would let the server
 * accept AI requests and only fail once Gemini rejects the call. Treat any
 * empty or obviously-unfilled value as "not configured" instead.
 * @param {string} key - Raw GEMINI_API_KEY value
 * @returns {boolean} True if the key looks like a real credential
 */
const isUsableApiKey = (key) => {
  const trimmed = (key || '').trim();
  if (!trimmed) return false;
  return !/^your[-_]/i.test(trimmed);
};

const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const awsRegion = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim();
// Bedrock model availability varies by region, so Bedrock can run in a
// different region from the rest of the AWS services (e.g. us-east-1).
const bedrockRegion = (process.env.BEDROCK_REGION || awsRegion).trim();
const pollyRegion = (process.env.POLLY_REGION || awsRegion || bedrockRegion).trim();
const bedrockModelId = (process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0').trim();

const AI_PROVIDERS = ['bedrock', 'gemini', 'none'];

/**
 * Resolve which AI provider serves the AI endpoints.
 * AI_PROVIDER picks one explicitly. When it is unset, a usable
 * GEMINI_API_KEY keeps selecting Gemini so existing deployments behave as
 * before; otherwise AI is off.
 * @returns {string} 'bedrock' | 'gemini' | 'none'
 */
const resolveAIProvider = () => {
  const requested = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (requested) {
    if (!AI_PROVIDERS.includes(requested)) {
      throw new Error(
        `AI_PROVIDER must be one of ${AI_PROVIDERS.join(', ')} (got '${process.env.AI_PROVIDER}').`
      );
    }
    return requested;
  }
  return isUsableApiKey(geminiApiKey) ? 'gemini' : 'none';
};

const aiProvider = resolveAIProvider();

/**
 * Decide whether the selected provider has what it needs to make a call.
 * Bedrock credentials (explicit keys, a profile or an IAM role — see
 * config/aws.js) can't be verified without a call, so a region and model ID
 * are the bar; a bad credential surfaces in /health/detailed instead.
 * @returns {boolean} True if AI requests should be attempted
 */
const isAIProviderConfigured = () => {
  switch (aiProvider) {
    case 'bedrock':
      return Boolean(bedrockRegion && bedrockModelId);
    case 'gemini':
      return isUsableApiKey(geminiApiKey);
    default:
      return false;
  }
};

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
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    bcryptRounds: 12,
  },

  // AWS (shared by every AWS SDK client — see config/aws.js)
  aws: {
    region: awsRegion,
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
    sessionToken: (process.env.AWS_SESSION_TOKEN || '').trim(),
    http: {
      connectionTimeoutMs: 10 * 1000,
      requestTimeoutMs: 60 * 1000,
      maxAttempts: 3,
    },
  },

  // AI configuration
  ai: {
    provider: aiProvider,
    // Gates the AI endpoints. False when the selected provider is missing
    // settings it needs, which makes them answer 503 AI_NOT_CONFIGURED
    // rather than attempting a call.
    enabled: isAIProviderConfigured(),
    tts: {
      maxTextLength: 2000,
    },
    context: {
      maxTranscriptLength: 25000,
    },

    // Amazon Bedrock (text) + Amazon Polly (speech)
    bedrock: {
      region: bedrockRegion,
      modelId: bedrockModelId,
      maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS, 10) || 4096,
      tts: {
        region: pollyRegion,
        voice: process.env.POLLY_VOICE_ID || 'Joanna',
        engine: process.env.POLLY_ENGINE || 'neural',
        // Polly PCM output supports only 8000 and 16000 Hz.
        sampleRate: 16000,
      },
    },

    // Google Gemini
    gemini: {
      apiKey: geminiApiKey,
      models: {
        chat: 'gemini-3-flash-preview',
        tts: 'gemini-2.5-flash-preview-tts',
      },
      tts: {
        voice: 'Kore',
      },
    },
  },

  // CORS configuration
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
