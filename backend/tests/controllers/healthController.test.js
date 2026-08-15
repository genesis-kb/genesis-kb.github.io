/**
 * Unit Tests — healthController.js
 *
 * Tests basic and detailed health checks.
 * Mocks: supabaseService, geminiService, config.
 */

import { jest } from '@jest/globals';

const mockSupabase = { healthCheck: jest.fn() };
const mockGemini = { healthCheck: jest.fn() };
const mockConfig = {
  server: { env: 'test', isProduction: false },
};

jest.unstable_mockModule('../../src/services/supabaseService.js', () => mockSupabase);
jest.unstable_mockModule('../../src/services/geminiService.js', () => mockGemini);
jest.unstable_mockModule('../../src/config/index.js', () => ({ default: mockConfig }));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  healthCheck,
  detailedHealthCheck,
} = await import('../../src/controllers/healthController.js');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.server.isProduction = false;
});

describe('healthCheck', () => {
  it('returns 200 with status healthy', () => {
    const res = createMockRes();
    healthCheck({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.environment).toBe('test');
  });
});

describe('detailedHealthCheck', () => {
  it('returns 200 and healthy when all services are up', async () => {
    mockSupabase.healthCheck.mockResolvedValueOnce(true);
    mockGemini.healthCheck.mockResolvedValueOnce(true);

    const res = createMockRes();
    await detailedHealthCheck({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.services.database.status).toBe('healthy');
    expect(res.body.data.services.gemini.status).toBe('healthy');
  });

  it('returns degraded status when database is down (in dev)', async () => {
    mockSupabase.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));
    mockGemini.healthCheck.mockResolvedValueOnce(true);

    const res = createMockRes();
    await detailedHealthCheck({}, res);

    expect(res.statusCode).toBe(200); // 200 in dev
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.services.database.status).toBe('unhealthy');
  });

  it('returns 503 when services are down in production', async () => {
    mockConfig.server.isProduction = true;
    mockSupabase.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));
    mockGemini.healthCheck.mockResolvedValueOnce(true);

    const res = createMockRes();
    await detailedHealthCheck({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
  });

  it('handles gemini service being down', async () => {
    mockSupabase.healthCheck.mockResolvedValueOnce(true);
    mockGemini.healthCheck.mockRejectedValueOnce(new Error('API inaccessible'));

    const res = createMockRes();
    await detailedHealthCheck({}, res);

    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.services.gemini.status).toBe('unhealthy');
  });
});
