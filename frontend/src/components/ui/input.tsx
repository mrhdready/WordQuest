import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-2xl border-2 border-border-subtle bg-surface-raised px-4',
        // 16 px Schriftgroesse verhindert, dass iOS beim Fokus hineinzoomt.
        'text-base text-ink placeholder:text-ink-soft/60',
        'focus:border-brand focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-2xl border-2 border-border-subtle bg-surface-raised p-4',
        'text-base text-ink placeholder:text-ink-soft/60',
        'focus:border-brand focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
