import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Fokusring kommt global aus index.css (:focus-visible, UI-SPEC D6).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full type-headline transition ' +
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-linear-to-b from-primary-light to-primary-deep text-on-primary ' +
          'shadow-lg shadow-primary/30 hover:brightness-95',
        secondary: 'glass-clear text-ink',
        outline: 'glass border border-border-control text-ink',
        ghost: 'text-ink hover:bg-glass-clear',
        danger: 'bg-surface-error text-danger-text',
        round: 'glass-clear text-ink',
        roundPrimary: 'bg-primary text-on-primary',
      },
      size: {
        // Kleinste Groesse liegt bewusst bei 44 px - darunter wird es auf
        // einem Tablet mit Kinderfingern unzuverlaessig (Leitplanke 3).
        sm: 'min-h-touch-min px-4',
        md: 'h-15 px-6',
        lg: 'h-16 px-8',
        xl: 'h-20 px-8',
        icon: 'size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
