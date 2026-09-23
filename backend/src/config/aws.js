/**
 * AWS Client Configuration
 * One place to build AWS SDK client options, so every client resolves
 * credentials, region and timeouts the same way.
 */

import config from './index.js';

/**
 * Build options for an AWS SDK v3 client.
 * Explicit keys are passed only when both are set; otherwise the SDK's
 * default provider chain (AWS_PROFILE, SSO, or an attached IAM role) is left
 * to resolve credentials instead of being handed empty strings.
 * @param {Object} [overrides] - Client options that take precedence (e.g. region)
 * @returns {Object} Options for `new XxxClient(...)`
 */
export const awsClientConfig = (overrides = {}) => {
  const { accessKeyId, secretAccessKey, sessionToken, region, http } = config.aws;

  return {
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
    ...(region ? { region } : {}),
    requestHandler: {
      connectionTimeout: http.connectionTimeoutMs,
      requestTimeout: http.requestTimeoutMs,
    },
    maxAttempts: http.maxAttempts,
    ...overrides,
  };
};

export default { awsClientConfig };
