/**
 * Bitcoin Transcripts Backend Server
 * Main entry point for the application
 */

import app from './app.js';
import config from './config/index.js';
import logger from './config/logger.js';

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

const server = app.listen(config.server.port, () => {
  logger.info('='.repeat(50));
  logger.info('Bitcoin Transcripts Backend Server');
  logger.info('='.repeat(50));
  logger.info(`Environment: ${config.server.env}`);
  logger.info(`Port: ${config.server.port}`);
  logger.info(`API URL: http://localhost:${config.server.port}/api/v1`);
  logger.info(`Health Check: http://localhost:${config.server.port}/api/v1/health`);
  logger.info('='.repeat(50));

  // Log configuration in development
  if (config.server.isDevelopment) {
    logger.debug('Configuration:', {
      databaseUrl: config.database.url ? '✓ Set' : '✗ Missing',
      aiProvider: config.ai.enabled
        ? `✓ ${config.ai.provider}`
        : `✗ ${config.ai.provider} not configured — AI endpoints disabled`,
      corsOrigins: config.cors.origins,
    });
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name || 'Error', err.message || err);
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM (graceful shutdown)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  
  server.close(() => {
    logger.info('Process terminated.');
    process.exit(0);
  });
});

export default server;
