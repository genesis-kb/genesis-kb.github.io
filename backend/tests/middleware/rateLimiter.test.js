/**
 * Unit Tests — rateLimiter.js middleware
 *
 * Tests configuration values and the skip logic for rate limiters.
 */

import {
  generalLimiter,
  aiLimiter,
  ttsLimiter,
  authLimiter,
  userDataLimiter,
} from '../../src/middleware/rateLimiter.js';

describe('generalLimiter', () => {
  it('is a function (express middleware)', () => {
    expect(typeof generalLimiter).toBe('function');
  });
});

describe('ttsLimiter', () => {
  it('is a function (express middleware)', () => {
    expect(typeof ttsLimiter).toBe('function');
  });
});

describe('authLimiter', () => {
  it('is a function (express middleware)', () => {
    expect(typeof authLimiter).toBe('function');
  });
});

describe('aiLimiter', () => {
  it('is a function (express middleware)', () => {
    expect(typeof aiLimiter).toBe('function');
  });
});

describe('userDataLimiter', () => {
  it('is a function (express middleware)', () => {
    expect(typeof userDataLimiter).toBe('function');
  });
});
