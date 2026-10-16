import { Slot } from '@radix-ui/react-slot'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// DESIGN.md list-group / list-separator: eine Glasflaeche, Trennlinie zwischen den Zeilen.
export function ListGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('glass flex flex-col divide-y divide-separator rounded-md', className)}
      {...props}
    />
  )
}

// DESIGN.md list-row: 60 px Mindesthoehe; asChild macht die ganze Zeile zum Link.
export function ListRow({
  className,
  asChild,
  ...props
}: ComponentProps<'div'> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'div'
  return (
    <Component
      className={cn('flex min-h-15 items-center gap-4 px-4 py-4 type-body-lg text-ink', className)}
      {...props}
    />
  )
}
