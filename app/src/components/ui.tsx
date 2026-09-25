/**
 * Ortak arayüz bileşenleri.
 *
 * Erişilebilirlik kuralları (CLAUDE.md Bölüm 10, WCAG 2.1 AA):
 *  - Dokunma hedefi en az 44px (mobil, eldivenli/titreyen el).
 *  - Her girdi görünür bir <label> ile bağlı; placeholder etiket YERİNE geçmez.
 *  - Hata metni `aria-describedby` ile girdiye bağlanır ve rengin yanında
 *    metinle de belirtilir (renk körlüğü).
 */

import { forwardRef, useId } from 'react'
import { twMerge } from 'tailwind-merge'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 disabled:bg-primary-700/50',
  secondary:
    'border border-primary-700 text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-950/60',
  ghost:
    'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-ink-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  full?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      {...rest}
      disabled={disabled === true || loading}
      aria-busy={loading}
      className={twMerge(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5',
        'text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_STYLES[variant],
        full && 'w-full',
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      role="status"
      className={twMerge(
        'inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Çözümlenmiş hata METNİ (anahtar değil) — bileşen çeviri yapmaz. */
  error?: string | undefined
  hint?: string | undefined
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(
  function TextField({ label, error, hint, className, id, ...rest }, ref) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    const describedBy =
      [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
      undefined

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
        <input
          {...rest}
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={twMerge(
            'min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base',
            'bg-white dark:bg-ink-900',
            error
              ? 'border-red-500 dark:border-red-400'
              : 'border-gray-300 dark:border-ink-700',
            className,
          )}
        />
        {hint && (
          <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  },
)

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export function TextArea({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: TextAreaProps): React.JSX.Element {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        {...rest}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={twMerge(
          'w-full rounded-xl border px-3.5 py-2.5 text-base',
          'bg-white dark:bg-ink-900',
          error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-ink-700',
          className,
        )}
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {error && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'error'

const ALERT_STYLES: Record<AlertTone, string> = {
  info: 'bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100',
  success:
    'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
  warning:
    'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  error: 'bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-100',
}

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: AlertTone
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      // Hata ve uyarı ekran okuyucuya anında duyurulur; bilgi/başarı kibar sırayla.
      role={tone === 'error' ? 'alert' : 'status'}
      className={twMerge('rounded-xl px-4 py-3 text-sm', ALERT_STYLES[tone], className)}
    >
      {children}
    </div>
  )
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={twMerge(
        'rounded-2xl border border-gray-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Çoklu seçim rozeti (ilgi alanı, beceri).
 * Gerçek bir <button> ve `aria-pressed` kullanır — ekran okuyucu seçili olup
 * olmadığını söyleyebilsin diye.
 */
export function ChipToggle({
  selected,
  onToggle,
  children,
  className,
}: {
  selected: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={twMerge(
        'min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        selected
          ? 'border-primary-700 bg-primary-700 text-white'
          : 'border-gray-300 bg-white text-gray-800 hover:border-primary-500 dark:border-ink-700 dark:bg-ink-900 dark:text-gray-200',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Tam sayfa yükleniyor perdesi — oturum çözülene kadar. */
export function FullPageLoader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Spinner className="size-8 text-primary-700" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  )
}
