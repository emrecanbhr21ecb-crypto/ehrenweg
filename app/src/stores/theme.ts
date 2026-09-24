/**
 * Tema tercihi (açık / koyu / sistem).
 * CLAUDE.md Bölüm 2: "karanlık/aydınlık tema" — BazaltGo'daki gibi.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

/** Tercihi <html class="dark"> üzerine uygular. */
function applyTheme(preference: ThemePreference): void {
  const prefersDark =
    preference === 'dark' ||
    (preference === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', prefersDark)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => {
        applyTheme(preference)
        set({ preference })
      },
    }),
    {
      name: 'ehrenweg.theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.preference ?? 'system')
      },
    },
  ),
)

/**
 * Sistem teması değişince (kullanıcı 'system' seçiliyse) anında yansıt.
 * Uygulama açılışında bir kez çağrılır.
 */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (): void => {
    if (useThemeStore.getState().preference === 'system') applyTheme('system')
  }
  media.addEventListener('change', handler)
  applyTheme(useThemeStore.getState().preference)
  return () => media.removeEventListener('change', handler)
}
