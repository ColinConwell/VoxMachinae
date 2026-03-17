import { describe, expect, it, vi } from 'vitest'

describe('api utilities', () => {
  it('uses relative paths when no explicit API base is configured', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', '')
    const { apiUrl } = await import('./api')

    expect(apiUrl('/api/health')).toBe('/api/health')
  })

  it('prefixes absolute API base values cleanly', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://vox.example.com/')
    const { apiUrl } = await import('./api')

    expect(apiUrl('/api/health')).toBe('https://vox.example.com/api/health')
  })
})
