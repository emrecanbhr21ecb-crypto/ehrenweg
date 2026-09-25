/**
 * Kurum formunda "Çeviri öner" + "Kolay dil öner" — CLAUDE.md Bölüm 12.
 *
 * Neden bu tek AI ucu kaldı: bir belediye çalışanı her aktivite için
 * Almanca + İngilizce + Leichte Sprache yazmaz. Yazmayınca o alanlar boş
 * kalır ve **Leichte Sprache tam olarak hedef kitlenin en çok ihtiyaç
 * duyduğu şey.** Burada AI süs değil, erişilebilirlik aracı.
 *
 * 🔒 Öneri ASLA doğrudan kaydedilmez: kutuda gösterilir, kurum "Übernehmen"
 * derse forma yazılır. Bölüm 12 bunu açıkça şart koşuyor — makinenin
 * ürettiği metin, kurumun onaylamadığı hâliyle katılımcıya gitmemeli.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Card } from '@/components/ui'
import { aiTranslate, type AiFailure } from '@/lib/ai'

export function AiTranslateBox({
  /** Kaynak metin — genelde Almanca alan. */
  source,
  from,
  to,
  onAcceptTranslation,
  onAcceptSimple,
}: {
  source: string
  from: 'de' | 'en'
  to: 'de' | 'en'
  onAcceptTranslation: (text: string) => void
  onAcceptSimple: (text: string) => void
}): React.JSX.Element | null {
  const { t } = useTranslation('notify')

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AiFailure | null>(null)
  const [proposal, setProposal] = useState<{
    translation: string
    simple: string
  } | null>(null)

  // Kaynak boşsa önerecek bir şey yok.
  if (source.trim().length < 10) return null

  async function run(simplify: boolean): Promise<void> {
    setBusy(true)
    setFailure(null)
    setProposal(null)

    const result = await aiTranslate({ text: source, from, to, simplify })
    setBusy(false)

    if (result.ok) setProposal(result.data)
    else setFailure(result.reason)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          loading={busy}
          onClick={() => void run(false)}
        >
          ✨ {busy ? t('ai.translating') : t('ai.translate')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          loading={busy}
          onClick={() => void run(true)}
        >
          ✨ {t('ai.simplify')}
        </Button>
      </div>

      {failure === 'unavailable' && (
        <Alert tone="info">
          <strong className="block">{t('ai.unavailableTitle')}</strong>
          {t('ai.unavailableBody')}
        </Alert>
      )}
      {failure === 'limit' && <Alert tone="warning">{t('ai.limit')}</Alert>}
      {failure === 'error' && <Alert tone="error">{t('ai.failed')}</Alert>}

      {proposal && (
        <Card className="space-y-3 bg-gray-50 dark:bg-ink-800/60">
          {proposal.translation && (
            <div className="space-y-2">
              <p className="whitespace-pre-line text-sm">{proposal.translation}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onAcceptTranslation(proposal.translation)
                  setProposal(null)
                }}
              >
                {t('ai.accept')}
              </Button>
            </div>
          )}

          {proposal.simple && (
            <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-ink-700">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('ai.simplify')}
              </p>
              <p className="whitespace-pre-line text-sm">{proposal.simple}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onAcceptSimple(proposal.simple)
                  setProposal(null)
                }}
              >
                {t('ai.accept')}
              </Button>
            </div>
          )}

          <Button type="button" variant="ghost" onClick={() => setProposal(null)}>
            {t('ai.discard')}
          </Button>
        </Card>
      )}
    </div>
  )
}
