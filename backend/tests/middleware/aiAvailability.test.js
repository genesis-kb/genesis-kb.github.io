/**
 * Unit Tests — aiAvailability.js middleware
 *
 * Tests the 503 gate on AI endpoints.
 * Mocks: config, logger.
 */

import { jest } from '@jest/globals';

const mockConfig = { ai: { provider: 'bedrock', enabled: true } };

jest.unstable_mockModule('../../src/config/index.js', () => ({ default: mockConfig }));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { requireAIConfigured } = await import('../../src/middleware/aiAvailability.js');

describe('requireAIConfigured', () => {
  it('calls next when an AI provider is configured', () => {
    mockConfig.ai.enabled = true;
    const next = jest.fn();

    requireAIConfigured({ path: '/chat', method: 'POST' }, {}, next);

    expect(next).toHaveBeenCalled();
  });

  it('throws 503 AI_NOT_CONFIGURED when no provider is configured', () => {
    mockConfig.ai.enabled = false;
    const next = jest.fn();

    expect(() => requireAIConfigured({ path: '/chat', method: 'POST' }, {}, next)).toThrow(
      expect.objectContaining({ statusCode: 503, code: 'AI_NOT_CONFIGURED' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
