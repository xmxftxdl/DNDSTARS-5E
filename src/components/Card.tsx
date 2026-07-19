import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export default function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div {...props} className={`glass rounded-2xl p-5 transition-all hover:border-white/20 ${className}`}>
      {children}
    </div>
  )
}
