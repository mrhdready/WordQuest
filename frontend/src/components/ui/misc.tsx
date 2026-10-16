import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('type-label-section text-ink-soft', className)}
      {...props}
    />
  )
}

// Vertrag bleibt 0 bis 1: alle Aufrufer uebergeben Anteile wie index / total.
// Intern Prozent, damit das native <progress> ohne Inline-Style auskommt.
export function Progress({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <progress
      max={100}
      value={Math.round(clamped * 100)}
      aria-label={label}
      className={cn('w-full', className)}
    />
  )
}

const badgeTones = {
  neutral: 'glass-flat-selected text-ink',
  green: 'bg-surface-success text-success-text',
  yellow: 'bg-surface-warn text-warn-text',
  red: 'bg-surface-error text-danger-text',
} as const

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 type-body-sm',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-ink-soft" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="type-body-md">{label}</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-sm bg-surface-error p-4 type-body-md-strong text-danger-text" role="alert">
      {message}
    </p>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass rounded-lg p-8 text-center">
      <p className="type-headline text-ink">{title}</p>
      {hint ? <p className="mt-1 type-body-md text-ink-soft">{hint}</p> : null}
    </div>
  )
}
