import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Innenabstand traegt die Karte selbst (DESIGN.md components.card, 24 px).
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('glass rounded-lg p-6 text-ink', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 pb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('type-headline', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('type-body-md text-ink-soft', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 pt-4', className)} {...props} />
}
