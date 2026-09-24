/**
 * Vitest ortak kurulumu (jsdom).
 * Testler Firebase'e GERÇEKTEN bağlanmaz; gereken yerde modül taklit edilir.
 */

import '@testing-library/jest-dom/vitest'

import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom'da matchMedia yok; tema deposu buna dayanıyor.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  cleanup()
})
