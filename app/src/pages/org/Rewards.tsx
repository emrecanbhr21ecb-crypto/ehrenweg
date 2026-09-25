/**
 * Kurum paneli — ödül şablonları ve bütçe (CLAUDE.md Bölüm 7.1).
 *
 * 🔒 `cash_voucher` seçeneği yalnız `organizations.features.cashVouchers`
 * açık olan kurumlarda görünür. Varsayılan KAPALI ve açma yetkisi yalnız
 * platform admin'de (Bölüm 7.6 + Bölüm 10 hukuki notu). Arayüzde gizlemek
 * tek başına yeterli değil — `firestore.rules` de kurumun bayrağını okuyup
 * doğruluyor.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  Badge,
  Button,
  Card,
  SelectField,
  Switch,
  TextArea,
  TextField,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import {
  createTemplate,
  expireVouchers,
  fetchOrgVouchers,
  updateTemplate,
  watchOrgTemplates,
} from '@/lib/rewards'
import { pickText, type ActivityValidationKey } from '@/types/activity'
import {
  REWARD_KINDS,
  formatCents,
  isMonetary,
  remainingBudgetCents,
  rewardTemplateSchema,
  type RewardKind,
  type RewardTemplate,
  type RewardTemplateForm,
  type Voucher,
} from '@/types/reward'
import type { Organization } from '@/types/activity'
import type { Locale } from '@/config/brand'

function emptyForm(): RewardTemplateForm {
  return {
    kind: 'gift_voucher',
    titleDe: '',
    titleEn: '',
    descriptionDe: '',
    descriptionEn: '',
    valueCents: 1000,
    discountPercent: 0,
    partnerOrgId: '',
    costIp: 100,
    validityDays: 90,
    totalBudgetCents: 50_000,
    maxPerUserPerMonth: 1,
    active: true,
  }
}

function toForm(template: RewardTemplate): RewardTemplateForm {
  return {
    kind: template.kind,
    titleDe: template.title.de,
    titleEn: template.title.en,
    descriptionDe: template.description.de,
    descriptionEn: template.description.en,
    valueCents: template.valueCents,
    discountPercent: template.discountPercent,
    partnerOrgId: template.partnerOrgId ?? '',
    costIp: template.costIp,
    validityDays: template.validityDays,
    totalBudgetCents: template.totalBudgetCents,
    maxPerUserPerMonth: template.maxPerUserPerMonth,
    active: template.active,
  }
}

export function OrgRewards({
  organization,
}: {
  organization: Organization
}): React.JSX.Element {
  const { t, i18n } = useTranslation(['wallet', 'errors', 'manage'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [templates, setTemplates] = useState<RewardTemplate[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<RewardTemplateForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cashAllowed = organization.features.cashVouchers

  useEffect(() => {
    return watchOrgTemplates(organization.id, setTemplates, (caught) => {
      console.error('[rewards] Şablonlar okunamadı:', caught)
    })
  }, [organization.id])

  useEffect(() => {
    void fetchOrgVouchers(organization.id)
      .then(setVouchers)
      .catch(() => setVouchers([]))
  }, [organization.id])

  const kinds = useMemo<RewardKind[]>(
    // Kapalıysa listede hiç görünmesin — kullanıcı seçip sonra reddedilmesin.
    () => REWARD_KINDS.filter((kind) => kind !== 'cash_voucher' || cashAllowed),
    [cashAllowed],
  )

  function patch(part: Partial<RewardTemplateForm>): void {
    setForm((current) => ({ ...current, ...part }))
  }

  async function save(): Promise<void> {
    if (!user) return
    const parsed = rewardTemplateSchema.safeParse(form)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !next[field]) {
          next[field] = t(issue.message as ActivityValidationKey, { ns: 'errors' })
        }
      }
      setErrors(next)
      return
    }

    setErrors({})
    setBusy(true)
    setError(null)
    try {
      if (editing === 'new') {
        await createTemplate(parsed.data, { orgId: organization.id, uid: user.uid })
      } else if (editing) {
        await updateTemplate(editing, parsed.data)
      }
      setEditing(null)
      setNotice(t('wallet:org.saved'))
    } catch (caught) {
      console.error('[rewards] Şablon kaydedilemedi:', caught)
      setError(t('wallet:org.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function runExpire(): Promise<void> {
    setBusy(true)
    try {
      const count = await expireVouchers(vouchers)
      setNotice(t('wallet:org.expireDone', { count }))
      setVouchers(await fetchOrgVouchers(organization.id))
    } catch (caught) {
      console.error('[rewards] Süre işaretlenemedi:', caught)
      setError(t('wallet:org.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('wallet:org.rewardsTitle')}</h2>
        <Button
          onClick={() => {
            setForm(emptyForm())
            setEditing('new')
          }}
        >
          ➕ {t('wallet:org.newReward')}
        </Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Bölüm 10 hukuki notu — kurum neden parasal kupon veremiyor */}
      {!cashAllowed && (
        <Alert tone="info">
          <strong className="block">{t('wallet:org.cashLocked')}</strong>
          {t('wallet:org.cashLegal')}
        </Alert>
      )}

      {editing && (
        <Card className="space-y-4">
          <h3 className="text-base font-semibold">
            {editing === 'new' ? t('wallet:org.newReward') : t('wallet:org.editReward')}
          </h3>

          <SelectField
            label={t('wallet:form.kind')}
            value={form.kind}
            onChange={(event) => patch({ kind: event.target.value as RewardKind })}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {t(`wallet:kind.${kind}`)}
              </option>
            ))}
          </SelectField>

          <TextField
            label={t('wallet:form.titleDe')}
            value={form.titleDe}
            error={errors['titleDe']}
            onChange={(event) => patch({ titleDe: event.target.value })}
          />
          <TextField
            label={t('wallet:form.titleEn')}
            value={form.titleEn}
            onChange={(event) => patch({ titleEn: event.target.value })}
          />
          <TextArea
            label={t('wallet:form.descriptionDe')}
            rows={2}
            value={form.descriptionDe}
            onChange={(event) => patch({ descriptionDe: event.target.value })}
          />
          <TextArea
            label={t('wallet:form.descriptionEn')}
            rows={2}
            value={form.descriptionEn}
            onChange={(event) => patch({ descriptionEn: event.target.value })}
          />

          {form.kind === 'discount' ? (
            <>
              <TextField
                label={t('wallet:form.discountPercent')}
                type="number"
                min={1}
                max={100}
                value={form.discountPercent}
                error={errors['discountPercent']}
                onChange={(event) =>
                  patch({ discountPercent: Number(event.target.value) })
                }
              />
              <TextField
                label={t('wallet:form.partnerOrgId')}
                hint={t('wallet:form.partnerHint')}
                value={form.partnerOrgId}
                onChange={(event) => patch({ partnerOrgId: event.target.value })}
              />
            </>
          ) : (
            <TextField
              label={t('wallet:form.valueEur')}
              hint={t('wallet:form.valueHint')}
              type="number"
              min={0}
              step={0.5}
              value={form.valueCents / 100}
              error={errors['valueCents']}
              onChange={(event) =>
                patch({ valueCents: Math.round(Number(event.target.value) * 100) })
              }
            />
          )}

          <TextField
            label={t('wallet:form.costIp')}
            hint={t('wallet:form.costHint')}
            type="number"
            min={0}
            value={form.costIp}
            error={errors['costIp']}
            onChange={(event) => patch({ costIp: Number(event.target.value) })}
          />

          <TextField
            label={t('wallet:form.validityDays')}
            type="number"
            min={1}
            max={730}
            value={form.validityDays}
            error={errors['validityDays']}
            onChange={(event) => patch({ validityDays: Number(event.target.value) })}
          />

          {isMonetary(form.kind) && (
            <TextField
              label={t('wallet:form.totalBudgetEur')}
              hint={t('wallet:form.budgetHint')}
              type="number"
              min={0}
              step={10}
              value={(form.totalBudgetCents ?? 0) / 100}
              error={errors['totalBudgetCents']}
              onChange={(event) =>
                patch({
                  totalBudgetCents: Math.round(Number(event.target.value) * 100),
                })
              }
            />
          )}

          <TextField
            label={t('wallet:form.maxPerUserPerMonth')}
            type="number"
            min={1}
            max={50}
            value={form.maxPerUserPerMonth}
            onChange={(event) =>
              patch({ maxPerUserPerMonth: Number(event.target.value) })
            }
          />

          <Switch
            checked={form.active}
            onChange={(next) => patch({ active: next })}
            label={t('wallet:form.active')}
          />

          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void save()}>
              {t('wallet:form.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('wallet:form.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {templates.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('wallet:org.rewardsEmpty')}
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => {
            const remaining = remainingBudgetCents(template)
            return (
              <li key={template.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{pickText(template.title, locale)}</p>
                    <div className="flex gap-2">
                      <Badge tone="info">{t(`wallet:kind.${template.kind}`)}</Badge>
                      {!template.active && (
                        <Badge tone="warning">{t('wallet:org.inactive')}</Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.kind === 'discount'
                      ? `${template.discountPercent} %`
                      : formatCents(template.valueCents, locale)}
                    {' · '}
                    {t('wallet:shop.cost', { count: template.costIp })}
                    {' · '}
                    {t('wallet:org.issued', { count: template.issuedCount })}
                  </p>

                  {template.totalBudgetCents !== null ? (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('wallet:org.budgetUsed', {
                          used: formatCents(template.spentCents, locale),
                          total: formatCents(template.totalBudgetCents, locale),
                        })}
                      </p>
                      <div
                        aria-hidden="true"
                        className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-ink-800"
                      >
                        <div
                          className={[
                            'h-full rounded-full',
                            (remaining ?? 0) > 0 ? 'bg-primary-600' : 'bg-red-500',
                          ].join(' ')}
                          style={{
                            width: `${Math.min(
                              100,
                              (template.spentCents /
                                Math.max(1, template.totalBudgetCents)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {t('wallet:org.budgetNone')}
                    </p>
                  )}

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setForm(toForm(template))
                      setEditing(template.id)
                    }}
                  >
                    {t('wallet:org.editReward')}
                  </Button>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {vouchers.length > 0 && (
        <Button variant="ghost" loading={busy} onClick={() => void runExpire()}>
          {t('wallet:org.expireRun')}
        </Button>
      )}
    </div>
  )
}
