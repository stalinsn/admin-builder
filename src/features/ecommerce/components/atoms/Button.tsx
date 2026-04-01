"use client";
import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'icon';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium transition-colors';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]',
    ghost: 'bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--card-bg)]',
  icon: 'bg-transparent p-2 text-[var(--text)]',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
