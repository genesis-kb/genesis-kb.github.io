/**
 * Jest Configuration for Backend (ES Modules)
 *
 * Uses Node's native ESM support via --experimental-vm-modules
 * (set in package.json "test" script).
 */
export default {
  testEnvironment: 'node',
  transform: {},                               // native ESM, no Babel
  testMatch: ['**/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  verbose: true,
  // Collect coverage from src/ only (exclude tests, node_modules)
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/logger.js',
  ],
};
