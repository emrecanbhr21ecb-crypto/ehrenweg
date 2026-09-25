import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import App from '@/App'
import { AuthProvider } from '@/lib/AuthProvider'
import { initAppCheck } from '@/lib/firebase'
import { watchSystemTheme } from '@/stores/theme'
import '@/styles/theme.css'
// i18n yan etki olarak kurulur; App'ten ÖNCE içe aktarılmalı.
import '@/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobil veri tasarrufu: pencere odağa gelince otomatik yeniden çekme yok.
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 2,
    },
  },
})

watchSystemTheme()
initAppCheck()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('[Ehrenweg] #root bulunamadı — index.html bozuk.')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
