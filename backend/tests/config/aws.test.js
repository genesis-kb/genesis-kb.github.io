/**
 * Unit Tests — config/aws.js
 *
 * Tests credential, region and timeout resolution for AWS SDK clients.
 * Mocks: config.
 */

import { jest } from '@jest/globals';

const mockConfig = {
  aws: {
    region: 'ap-south-1',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    http: { connectionTimeoutMs: 10000, requestTimeoutMs: 60000, maxAttempts: 3 },
  },
};

jest.unstable_mockModule('../../src/config/index.js', () => ({ default: mockConfig }));

const { awsClientConfig } = await import('../../src/config/aws.js');

beforeEach(() => {
  Object.assign(mockConfig.aws, { accessKeyId: '', secretAccessKey: '', sessionToken: '' });
});

describe('awsClientConfig', () => {
  it('passes explicit credentials when both keys are set', () => {
    Object.assign(mockConfig.aws, { accessKeyId: 'AKIA', secretAccessKey: 'secret' });

    expect(awsClientConfig().credentials).toEqual({
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    });
  });

  it('includes the session token for temporary credentials', () => {
    Object.assign(mockConfig.aws, {
      accessKeyId: 'ASIA',
      secretAccessKey: 'secret',
      sessionToken: 'token',
    });

    expect(awsClientConfig().credentials.sessionToken).toBe('token');
  });

  it('leaves credentials to the default chain when a key is missing', () => {
    Object.assign(mockConfig.aws, { accessKeyId: 'AKIA' });

    expect(awsClientConfig()).not.toHaveProperty('credentials');
  });

  it('uses the shared region and HTTP settings', () => {
    expect(awsClientConfig()).toMatchObject({
      region: 'ap-south-1',
      requestHandler: { connectionTimeout: 10000, requestTimeout: 60000 },
      maxAttempts: 3,
    });
  });

  it('lets overrides win over shared settings', () => {
    expect(awsClientConfig({ region: 'us-east-1' }).region).toBe('us-east-1');
  });
});
