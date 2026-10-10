import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-bold transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-primary text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:bg-blue-600',
      secondary:
        'bg-blue-50 text-primary border border-blue-100 hover:bg-blue-100 shadow-sm',
      danger:
        'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 shadow-sm',
      outline:
        'bg-white text-slate-700 border border-gray-200 hover:bg-gray-50 shadow-sm',
      ghost: 'bg-transparent text-slate-600 hover:bg-gray-100 hover:text-slate-800',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'py-1.5 px-3 text-xs rounded-lg',
      md: 'py-2.5 px-5 text-sm rounded-xl',
      lg: 'py-3.5 px-6 text-base rounded-2xl',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
