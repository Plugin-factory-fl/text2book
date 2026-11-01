'use client';

import { cn } from '@/lib/utils';

interface PanelToggleProps {
  isOpen: boolean;
  onClick: () => void;
  direction: 'left' | 'right';
  className?: string;
  label?: string;
}

export function PanelToggle({ isOpen, onClick, direction, className, label }: PanelToggleProps) {
  const chevronDirection = direction === 'left' 
    ? (isOpen ? 'rotate-0' : 'rotate-180')
    : (isOpen ? 'rotate-180' : 'rotate-0');

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
        className
      )}
      aria-label={label || (isOpen ? 'Collapse panel' : 'Expand panel')}
      aria-expanded={isOpen}
      title={label || (isOpen ? 'Collapse panel' : 'Expand panel')}
    >
      <svg
        className={cn('w-5 h-5 text-gray-500 transition-transform duration-200', chevronDirection)}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}

export function PanelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
      />
    </svg>
  );
}
