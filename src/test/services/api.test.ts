/**
 * Unit Tests — services/api.ts
 *
 * Tests the API client: auth header injection, timeout, error handling,
 * 401 token clearing, and APIError class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { APIError } from '../../../services/api'

// We test APIError class directly (it's exported)
// and the `api` request functions via mocked fetch.

describe('APIError', () => {
  it('sets message, statusCode, and code', () => {
    const err = new APIError('Not found', 404, 'NOT_FOUND')
    expect(err.message).toBe('Not found')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('APIError')
  })

  it('defaults code to API_ERROR', () => {
    const err = new APIError('fail', 500)
    expect(err.code).toBe('API_ERROR')
  })

  it('is an instance of Error', () => {
    const err = new APIError('test', 400)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(APIError)
  })
})

describe('api.request (via api.get/post)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('injects Bearer token from localStorage', async () => {
    localStorage.setItem('btc-auth-token', 'my-jwt-token')

    let capturedHeaders: Headers | undefined
    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers as HeadersInit)
      return new Response(
        JSON.stringify({ success: true, data: { result: 'ok' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    const { api } = await import('../../../services/api')
    await api.get('/api/v1/test')

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer my-jwt-token')
  })

  it('does not inject Authorization header when no token stored', async () => {
    let capturedHeaders: Headers | undefined
    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers as HeadersInit)
      return new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    const { api } = await import('../../../services/api')
    await api.get('/api/v1/test')

    expect(capturedHeaders?.get('Authorization')).toBeNull()
  })

  it('throws APIError with CONNECTION_ERROR on network failure', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch

    const { api } = await import('../../../services/api')

    await expect(api.get('/api/v1/test')).rejects.toMatchObject({
      statusCode: 503,
      code: 'CONNECTION_ERROR',
    })
  })

  it('throws APIError on non-JSON response', async () => {
    global.fetch = vi.fn(async () =>
      new Response('plain text', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    ) as unknown as typeof fetch

    const { api } = await import('../../../services/api')

    await expect(api.get('/api/v1/test')).rejects.toMatchObject({
      statusCode: 500,
      code: 'INVALID_RESPONSE',
    })
  })

  it('clears token on 401 response', async () => {
    localStorage.setItem('btc-auth-token', 'expired-token')

    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch

    const { api } = await import('../../../services/api')

    await expect(api.get('/api/v1/test')).rejects.toMatchObject({
      statusCode: 401,
    })

    expect(localStorage.getItem('btc-auth-token')).toBeNull()
  })

  it('sends JSON body on POST requests', async () => {
    let capturedBody: string | undefined
    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string
      return new Response(
        JSON.stringify({ success: true, data: { id: '1' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    const { api } = await import('../../../services/api')
    await api.post('/api/v1/test', { email: 'test@example.com' })

    const parsed = JSON.parse(capturedBody!)
    expect(parsed.email).toBe('test@example.com')
  })

  it('throws APIError with server error code on 500', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Something broke' },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch

    const { api } = await import('../../../services/api')

    await expect(api.get('/api/v1/test')).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something broke',
    })
  })
})
