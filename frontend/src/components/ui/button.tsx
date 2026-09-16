import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition ' +
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-sm hover:bg-brand-strong',
        secondary: 'bg-brand-soft text-brand-strong hover:brightness-97',
        outline: 'border-2 border-border-subtle bg-surface-raised text-ink hover:bg-brand-soft',
        ghost: 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong',
        danger: 'bg-danger text-white hover:brightness-95',
      },
      size: {
        // Kleinste Groesse liegt bewusst bei 44 px - darunter wird es auf
        // einem Tablet mit Kinderfingern unzuverlaessig (Leitplanke 3).
        sm: 'h-11 px-4 text-sm',
        md: 'h-12 px-5 text-base',
        lg: 'h-14 px-7 text-lg',
        xl: 'h-16 px-8 text-xl',
        icon: 'h-12 w-12',
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
