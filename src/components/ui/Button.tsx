import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-brand)] text-white hover:bg-[#143028] disabled:bg-stone-300',
  secondary:
    'bg-[var(--color-accent)] text-white hover:bg-[#bf5524] disabled:bg-stone-300',
  ghost: 'bg-transparent hover:bg-stone-100 text-stone-800',
  danger: 'bg-[var(--color-danger)] text-white hover:bg-[#a61e1e]',
  outline: 'border border-stone-300 bg-white hover:bg-stone-50 text-stone-800',
  soft: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[#d9e5df]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
  icon: 'h-10 w-10 rounded-xl inline-flex items-center justify-center',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = 'primary', size = 'md', ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)
