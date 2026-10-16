import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Fokus zeigt der globale :focus-visible-Ring (UI-SPEC D6); die 1-px-Grenze in
// border-control haelt die Feldgrenze auf Glas sichtbar (WCAG 1.4.11).
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-13 w-full rounded-full border border-border-control glass-flat px-4',
        // 17 px Schriftgroesse verhindert, dass iOS beim Fokus hineinzoomt.
        'type-body-lg text-ink placeholder:text-ink-soft',
        'disabled:opacity-50 aria-invalid:border-danger-text',
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
        'w-full rounded-sm border border-border-control glass-flat p-4',
        'type-body-lg text-ink placeholder:text-ink-soft',
        'disabled:opacity-50 aria-invalid:border-danger-text',
        className,
      )}
      {...props}
    />
  )
}
