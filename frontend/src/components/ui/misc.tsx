import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-semibold text-ink-soft', className)}
      {...props}
    />
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-brand-soft', className)}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

const badgeTones = {
  neutral: 'bg-brand-soft text-brand-strong',
  green: 'bg-success-soft text-success',
  yellow: 'bg-warn-soft text-warn',
  red: 'bg-danger-soft text-danger',
} as const

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-ink-soft" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
      {message}
    </p>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-dashed border-border-subtle p-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  )
}
