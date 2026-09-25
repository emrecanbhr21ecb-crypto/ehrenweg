/**
 * Kurum paneli — aktivite oluşturma / düzenleme formu (CLAUDE.md Bölüm 9).
 *
 * Kapsanan alanlar: DE ve EN başlık/açıklama, Leichte-Sprache özeti, kategori,
 * kazanılan beceriler, adres + harita pini, online seçeneği, tarih/saat, son
 * başvuru, kontenjan, başvuru gerekli mi, minimum seviye, verilecek IP,
 * kapak görseli.
 *
 * ⚠️ Kapak görseli şimdilik **bağlantı** olarak giriliyor. Dosya yükleme
 * Firebase Storage istiyor, Storage da Blaze planı istiyor (docs/DECISIONS.md
 * §7). Alan ve veri modeli hazır; Blaze açılınca yerine yükleyici gelir.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { AiTranslateBox } from '@/components/AiTranslateBox'
import { MapView } from '@/components/MapView'
import {
  Alert,
  Button,
  Card,
  ChipToggle,
  SelectField,
  Spinner,
  Switch,
  TextArea,
  TextField,
} from '@/components/ui'
import {
  CATEGORY_IDS,
  CATEGORY_META,
  LANGUAGE_CODES,
  SKILL_IDS,
  type CategoryId,
  type LanguageCode,
  type SkillId,
} from '@/config/catalog'
import { DEFAULT_MAP_CENTER } from '@/config/cities'
import { useAuth } from '@/lib/AuthProvider'
import {
  createActivityDraft,
  fetchActivity,
  submitActivity,
  toLocalInputValue,
  updateActivityContent,
} from '@/lib/activities'
import { durationHours } from '@/lib/format'
import { fetchOrganization } from '@/lib/organizations'
import {
  ACTIVITY_TYPES,
  activityFormSchema,
  MAX_ACTIVITY_IP,
  type ActivityFormValues,
  type ActivityType,
  type ActivityValidationKey,
} from '@/types/activity'

const MIN_LEVELS = [0, 1, 2, 3, 4, 5] as const

function emptyValues(): ActivityFormValues {
  return {
    type: 'volunteering',
    title: { de: '', en: '' },
    description: { de: '', en: '' },
    simpleDescription: { de: '', en: '' },
    categoryId: 'community',
    skillsGained: [],
    languagesUsed: ['de'],
    online: false,
    address: '',
    lat: null,
    lng: null,
    startAt: '',
    endAt: '',
    applicationDeadline: '',
    capacity: 20,
    requiresApplication: true,
    minLevel: 0,
    rewardIp: 20,
    hoursCredited: 2,
    coverImageURL: '',
    passportEnabled: true,
  }
}

export default function ActivityForm(): React.JSX.Element {
  const { activityId } = useParams()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation([
    'manage',
    'catalog',
    'errors',
    'common',
    'activities',
    'notify',
  ])
  const navigate = useNavigate()
  const { user, orgRoles } = useAuth()

  const editing = Boolean(activityId)
  const orgIdFromQuery = searchParams.get('org') ?? Object.keys(orgRoles)[0] ?? ''

  const [orgId, setOrgId] = useState(orgIdFromQuery)
  const [orgName, setOrgName] = useState('')
  const [values, setValues] = useState<ActivityFormValues>(emptyValues)
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Düzenleme: mevcut aktiviteyi forma doldur.
  useEffect(() => {
    if (!activityId) return
    let cancelled = false

    void fetchActivity(activityId)
      .then((activity) => {
        if (cancelled || !activity) {
          setLoading(false)
          return
        }
        setOrgId(activity.orgId)
        setOrgName(activity.orgName)
        setValues({
          type: activity.type,
          title: activity.title,
          description: activity.description,
          simpleDescription: activity.simpleDescription,
          categoryId: activity.categoryId,
          skillsGained: activity.skillsGained,
          languagesUsed: activity.languagesUsed,
          online: activity.online,
          address: activity.location.address,
          lat: activity.location.lat,
          lng: activity.location.lng,
          startAt: toLocalInputValue(activity.startAt),
          endAt: toLocalInputValue(activity.endAt),
          applicationDeadline: toLocalInputValue(activity.applicationDeadline),
          capacity: activity.capacity,
          requiresApplication: activity.requiresApplication,
          minLevel: activity.minLevel,
          rewardIp: activity.rewards.ip,
          hoursCredited: activity.hoursCredited,
          coverImageURL: activity.coverImageURL ?? '',
          passportEnabled: activity.passportEnabled,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))

    return () => {
      cancelled = true
    }
  }, [activityId])

  // Yeni kayıt: kurum adını aktiviteye kopyalamak için oku.
  useEffect(() => {
    if (editing || !orgId) return
    void fetchOrganization(orgId).then((organization) => {
      if (organization) setOrgName(organization.name)
    })
  }, [editing, orgId])

  const patch = (part: Partial<ActivityFormValues>): void =>
    setValues((current) => ({ ...current, ...part }))

  const suggestedHours = useMemo(() => {
    if (!values.startAt || !values.endAt) return null
    const start = new Date(values.startAt)
    const end = new Date(values.endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const hours = durationHours(start, end)
    return hours > 0 ? Math.round(hours * 10) / 10 : null
  }, [values.startAt, values.endAt])

  function validate(): ActivityFormValues | null {
    const parsed = activityFormSchema.safeParse(values)
    if (parsed.success) {
      setErrors({})
      return parsed.data
    }

    const next: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'form'
      if (!next[field]) {
        next[field] = t(issue.message as ActivityValidationKey, { ns: 'errors' })
      }
    }
    setErrors(next)
    return null
  }

  async function save(thenSubmit: boolean): Promise<void> {
    const parsed = validate()
    if (!parsed || !user || !orgId) return

    setBusy(true)
    setFormError(null)

    try {
      const id = editing
        ? (await updateActivityContent(activityId as string, parsed),
          activityId as string)
        : await createActivityDraft(parsed, { orgId, orgName, uid: user.uid })

      if (thenSubmit) await submitActivity(id)
      void navigate(`/org?org=${orgId}`, { replace: true })
    } catch (caught) {
      console.error('[org] Aktivite kaydedilemedi:', caught)
      setFormError(t('manage:form.saveFailed'))
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  const pinCenter =
    values.lat !== null && values.lng !== null
      ? { lat: values.lat, lng: values.lng }
      : null

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save(false)
      }}
      noValidate
    >
      <header>
        <h1 className="text-2xl font-bold">
          {editing ? t('manage:form.editTitle') : t('manage:form.newTitle')}
        </h1>
        {orgName && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{orgName}</p>
        )}
      </header>

      {formError && <Alert tone="error">{formError}</Alert>}

      {/* --- Ne? --- */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">{t('manage:form.sectionWhat')}</h2>

        <SelectField
          label={t('manage:form.type')}
          value={values.type}
          onChange={(event) => patch({ type: event.target.value as ActivityType })}
        >
          {ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`activities:type.${type}`)}
            </option>
          ))}
        </SelectField>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('manage:form.bilingualHint')}
        </p>

        <TextField
          label={t('manage:form.titleDe')}
          value={values.title.de}
          error={errors['title']}
          onChange={(event) =>
            patch({ title: { ...values.title, de: event.target.value } })
          }
        />
        <TextField
          label={t('manage:form.titleEn')}
          value={values.title.en}
          onChange={(event) =>
            patch({ title: { ...values.title, en: event.target.value } })
          }
        />

        <TextArea
          label={t('manage:form.descriptionDe')}
          rows={4}
          value={values.description.de}
          error={errors['description']}
          onChange={(event) =>
            patch({ description: { ...values.description, de: event.target.value } })
          }
        />
        <TextArea
          label={t('manage:form.descriptionEn')}
          rows={4}
          value={values.description.en}
          onChange={(event) =>
            patch({ description: { ...values.description, en: event.target.value } })
          }
        />

        {/* Tek AI ucu: Almanca açıklamadan İngilizce çeviri + kolay dil
            özeti önerir. Öneri kaydedilmez, kurum "Übernehmen" derse forma
            yazılır (CLAUDE.md Bölüm 12). */}
        <AiTranslateBox
          source={values.description.de}
          from="de"
          to="en"
          onAcceptTranslation={(text) =>
            patch({ description: { ...values.description, en: text } })
          }
          onAcceptSimple={(text) =>
            patch({
              simpleDescription: { ...values.simpleDescription, de: text },
            })
          }
        />

        <TextArea
          label={t('manage:form.simpleDe')}
          hint={t('manage:form.simpleHint')}
          rows={3}
          value={values.simpleDescription.de}
          onChange={(event) =>
            patch({
              simpleDescription: {
                ...values.simpleDescription,
                de: event.target.value,
              },
            })
          }
        />
        <TextArea
          label={t('manage:form.simpleEn')}
          rows={3}
          value={values.simpleDescription.en}
          onChange={(event) =>
            patch({
              simpleDescription: {
                ...values.simpleDescription,
                en: event.target.value,
              },
            })
          }
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {t('manage:form.category')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_IDS.map((id) => (
              <ChipToggle
                key={id}
                selected={values.categoryId === id}
                onToggle={() => patch({ categoryId: id as CategoryId })}
              >
                <span aria-hidden="true" className="me-1">
                  {CATEGORY_META[id].emoji}
                </span>
                {t(`catalog:categories.${id}`)}
              </ChipToggle>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {t('manage:form.skills')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {SKILL_IDS.map((id) => (
              <ChipToggle
                key={id}
                selected={values.skillsGained.includes(id)}
                onToggle={() =>
                  patch({
                    skillsGained: values.skillsGained.includes(id)
                      ? values.skillsGained.filter((entry) => entry !== id)
                      : [...values.skillsGained, id as SkillId],
                  })
                }
              >
                {t(`catalog:skills.${id}`)}
              </ChipToggle>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">
            {t('manage:form.languages')}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t('manage:form.languagesHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_CODES.map((code) => (
              <ChipToggle
                key={code}
                selected={values.languagesUsed.includes(code)}
                onToggle={() =>
                  patch({
                    languagesUsed: values.languagesUsed.includes(code)
                      ? values.languagesUsed.filter((entry) => entry !== code)
                      : [...values.languagesUsed, code as LanguageCode],
                  })
                }
              >
                {t(`catalog:languages.codes.${code}`)}
              </ChipToggle>
            ))}
          </div>
          {errors['languagesUsed'] && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors['languagesUsed']}
            </p>
          )}
        </fieldset>
      </Card>

      {/* --- Nerede / ne zaman? --- */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">{t('manage:form.sectionWhere')}</h2>

        <Switch
          checked={values.online}
          onChange={(next) => patch({ online: next })}
          label={t('manage:form.online')}
          hint={t('manage:form.onlineHint')}
        />

        {!values.online && (
          <>
            <TextField
              label={t('manage:form.address')}
              hint={t('manage:form.addressHint')}
              value={values.address}
              error={errors['address']}
              onChange={(event) => patch({ address: event.target.value })}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('manage:form.pin')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('manage:form.pinHint')}
              </p>

              <MapView
                ariaLabel={t('manage:form.pin')}
                className="h-64 w-full rounded-2xl"
                pickable
                center={pinCenter ?? DEFAULT_MAP_CENTER}
                markers={
                  pinCenter
                    ? [
                        {
                          id: 'pin',
                          lat: pinCenter.lat,
                          lng: pinCenter.lng,
                          emoji: '📍',
                          title: t('manage:form.pin'),
                        },
                      ]
                    : []
                }
                onPick={(point) => patch({ lat: point.lat, lng: point.lng })}
              />

              {pinCenter ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => patch({ lat: null, lng: null })}
                >
                  {t('manage:form.pinClear')}
                </Button>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('manage:form.pinMissing')}
                </p>
              )}
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('manage:form.startAt')}
            type="datetime-local"
            value={values.startAt}
            error={errors['startAt']}
            onChange={(event) => patch({ startAt: event.target.value })}
          />
          <TextField
            label={t('manage:form.endAt')}
            type="datetime-local"
            value={values.endAt}
            error={errors['endAt']}
            onChange={(event) => patch({ endAt: event.target.value })}
          />
        </div>

        <TextField
          label={t('manage:form.deadline')}
          hint={t('manage:form.deadlineHint')}
          type="datetime-local"
          value={values.applicationDeadline}
          error={errors['applicationDeadline']}
          onChange={(event) => patch({ applicationDeadline: event.target.value })}
        />
      </Card>

      {/* --- Başvuru --- */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">{t('manage:form.sectionWho')}</h2>

        <Switch
          checked={values.requiresApplication}
          onChange={(next) => patch({ requiresApplication: next })}
          label={t('manage:form.requiresApplication')}
          hint={t('manage:form.requiresApplicationHint')}
        />

        <TextField
          label={t('manage:form.capacity')}
          type="number"
          min={1}
          max={1000}
          value={values.capacity}
          error={errors['capacity']}
          onChange={(event) => patch({ capacity: Number(event.target.value) })}
        />

        <SelectField
          label={t('manage:form.minLevel')}
          value={String(values.minLevel)}
          onChange={(event) => patch({ minLevel: Number(event.target.value) })}
        >
          {MIN_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level === 0
                ? t('manage:form.minLevelAny')
                : t('activities:detail.minLevel', { level })}
            </option>
          ))}
        </SelectField>
      </Card>

      {/* --- Anrechnung --- */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold">{t('manage:form.sectionReward')}</h2>

        <TextField
          label={t('manage:form.rewardIp')}
          hint={t('manage:form.rewardIpHint')}
          type="number"
          min={0}
          max={MAX_ACTIVITY_IP}
          value={values.rewardIp}
          error={errors['rewardIp']}
          onChange={(event) => patch({ rewardIp: Number(event.target.value) })}
        />

        <TextField
          label={t('manage:form.hoursCredited')}
          hint={
            suggestedHours !== null
              ? t('manage:form.hoursSuggestion', { hours: suggestedHours })
              : undefined
          }
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={values.hoursCredited}
          onChange={(event) => patch({ hoursCredited: Number(event.target.value) })}
        />

        <TextField
          label={t('manage:form.coverImage')}
          hint={t('manage:form.coverImageHint')}
          type="url"
          placeholder="https://"
          value={values.coverImageURL}
          error={errors['coverImageURL']}
          onChange={(event) => patch({ coverImageURL: event.target.value })}
        />

        <Switch
          checked={values.passportEnabled}
          onChange={(next) => patch({ passportEnabled: next })}
          label={t('manage:form.passportEnabled')}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" loading={busy}>
          {editing ? t('manage:form.saveChanges') : t('manage:form.saveDraft')}
        </Button>
        <Button type="button" loading={busy} onClick={() => void save(true)}>
          {t('manage:form.saveAndSubmit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void navigate(-1)}>
          {t('common:action.cancel')}
        </Button>
      </div>
    </form>
  )
}
