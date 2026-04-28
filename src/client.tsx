import * as React from 'react'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

// Make React available as a global for any module that expects it
// (some transformed modules reference `React` without an explicit import).
;(globalThis as unknown as { React: typeof React }).React = React

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
