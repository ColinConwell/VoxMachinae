import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WaveformView } from './WaveformView'

const { createMock, loadBlob, destroy, on } = vi.hoisted(() => ({
  createMock: vi.fn(),
  loadBlob: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
}))

vi.mock('wavesurfer.js', () => ({
  default: {
    create: createMock,
  },
}))

describe('WaveformView', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    loadBlob.mockResolvedValue(undefined)
    destroy.mockReset()
    on.mockReturnValue(() => {})
    createMock.mockReturnValue({
      loadBlob,
      destroy,
      on,
      playPause: vi.fn(),
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads waveform audio through fetch and passes a blob to wavesurfer', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['abc'], { type: 'audio/wav' }), {
        status: 200,
      }),
    )

    render(<WaveformView sessionId="session-123" source="original" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/session/session-123/download?source=original', {
        signal: expect.any(AbortSignal),
      })
    })

    await waitFor(() => {
      expect(loadBlob).toHaveBeenCalledTimes(1)
    })
  })

  it('suppresses abort errors during teardown', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    ) as typeof fetch

    const { unmount } = render(<WaveformView sessionId="session-456" source="processed" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    unmount()

    await Promise.resolve()

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
