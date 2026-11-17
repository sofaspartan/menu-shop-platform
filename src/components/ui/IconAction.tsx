import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Ghost icon control for dashboard list/detail chrome.
 * Matches Menus section actions: pencil / eye / trash row.
 */
export function IconAction({
  label,
  danger,
  children,
  className,
  ...props
}: {
  label: string
  danger?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      className={cn('px-2', danger && 'hover:bg-red-50', className)}
      {...props}
    >
      <span className={cn(danger && 'text-red-600')}>{children}</span>
    </Button>
  )
}
