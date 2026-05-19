import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-bold font-label uppercase tracking-wider rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 dark:hover:bg-zinc-100 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]',
    secondary: 'bg-[#006b5c] dark:bg-cyan-500/20 text-white dark:text-cyan-400 border border-[#006b5c] dark:border-cyan-500/30 hover:opacity-90 dark:hover:bg-cyan-500/30',
    outline: 'bg-transparent border border-zinc-300 dark:border-zinc-800 text-black dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm'
  };

  const sizeStyles = {
    sm: 'px-md py-1.5 text-[10px]',
    md: 'px-lg py-2 text-xs',
    lg: 'px-xl py-3 text-sm'
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
