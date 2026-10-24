import type { ReactNode } from 'react'
import { Label } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/**
 * Label, Eingabe, Hilfe- und Fehlertext mit fester ARIA-Verdrahtung
 * (UI-SPEC "Validierung und Fehleranzeige"): die Eingabe kommt als Render-Prop
 * und bekommt id, aria-describedby und aria-invalid.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  className?: string
  children: (control: FieldControlProps) => ReactNode
}) {
  const hintId = `${id}-hilfe`
  const errorId = `${id}-fehler`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-1">
        {children({
          id,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : undefined,
        })}
        {hint ? (
          <p id={hintId} className="type-body-md text-ink-soft">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="type-body-md-strong text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
