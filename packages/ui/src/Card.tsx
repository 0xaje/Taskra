import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  glass = false,
  hoverable = false,
  className = '',
  ...props
}) => {
  const baseStyle = 'p-md rounded-lg border transition-all duration-300 shadow-sm';
  
  const glassStyle = glass
    ? 'bg-[#fafaf5]/85 dark:bg-[#0e1013]/85 backdrop-blur-md border-[#c4c7c7] dark:border-zinc-800'
    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80';
    
  const hoverStyle = hoverable
    ? 'hover:border-black dark:hover:border-zinc-500 hover:shadow-md'
    : '';

  return (
    <div
      className={`${baseStyle} ${glassStyle} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
