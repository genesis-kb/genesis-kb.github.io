/**
 * Express Application Configuration
 * Sets up middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config from './config/index.js';
import logger from './config/logger.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler, generalLimiter } from './middleware/index.js';

// Request timeout duration (30 seconds)
const REQUEST_TIMEOUT = 30000;

// Create Express app
const app = express();

// ===========================================
// Security Middleware
// ===========================================

// Helmet - Sets various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (config.cors.origins.includes(origin) || config.server.isDevelopment) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
  maxAge: 86400, // 24 hours
}));

// ===========================================
// General Middleware
// ===========================================

// Request parsing
app.use(express.json({ limit: '10mb' })); // JSON body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
if (config.server.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Response compression
app.use(compression());

// Rate limiting (applies to all routes)
app.use('/api', generalLimiter);

// Request ID for debugging
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request timestamp and timeout
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  // Set request timeout
  req.setTimeout(REQUEST_TIMEOUT, () => {
    logger.warn(`Request timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request took too long to process',
        },
      });
    }
  });

  next();
});

// ===========================================
// Routes
// ===========================================

// API v1 routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bitcoin Transcripts Backend API',
    version: '1.0.0',
    documentation: '/api/v1',
    health: '/api/v1/health',
  });
});

// ===========================================
// Error Handling
// ===========================================

// 404 handler - Must be after all routes
app.use(notFoundHandler);

// Global error handler - Must be last
app.use(errorHandler);

export default app;
