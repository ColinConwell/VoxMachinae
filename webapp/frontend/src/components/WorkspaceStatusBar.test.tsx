import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkspaceStatusBar } from './WorkspaceStatusBar'

describe('WorkspaceStatusBar', () => {
  it('renders workspace metadata and processed state', () => {
    render(
      <WorkspaceStatusBar
        name="lead-vocal.wav"
        duration={95.4}
        sampleRate={48_000}
        channels={2}
        hasProcessedAudio
        onReset={() => {}}
        resetting={false}
      />,
    )

    expect(document.body).toHaveTextContent('Workspace')
    expect(document.body).toHaveTextContent('Processed')
    expect(document.body).toHaveTextContent('lead-vocal.wav')
    expect(document.body).toHaveTextContent('48,000 Hz')
    expect(document.body).toHaveTextContent('2 ch')
  })

  it('disables reset when there is no processed audio and calls reset when active', () => {
    const onReset = vi.fn()
    const { rerender } = render(
      <WorkspaceStatusBar
        name="dry.wav"
        duration={12}
        sampleRate={44_100}
        channels={1}
        hasProcessedAudio={false}
        onReset={onReset}
        resetting={false}
      />,
    )

    const disabledButton = document.querySelector('button')
    expect(disabledButton).toBeDisabled()

    rerender(
      <WorkspaceStatusBar
        name="wet.wav"
        duration={12}
        sampleRate={44_100}
        channels={1}
        hasProcessedAudio
        onReset={onReset}
        resetting={false}
      />,
    )

    const enabledButton = document.querySelector('button')
    enabledButton?.click()
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
