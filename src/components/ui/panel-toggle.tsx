'use client';

import { cn } from '@/lib/utils';

interface PanelToggleProps {
  isOpen: boolean;
  onClick: () => void;
  direction: 'left' | 'right';
  className?: string;
  label?: string;
}

function PanelLeftCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

function PanelLeftOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

function PanelRightCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
      <path d="m8 9 3 3-3 3" />
    </svg>
  );
}

function PanelRightOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
      <path d="m10 15-3-3 3-3" />
    </svg>
  );
}

export function PanelToggle({ isOpen, onClick, direction, className, label }: PanelToggleProps) {
  const defaultLabel = direction === 'left'
    ? (isOpen ? 'Hide sidebar' : 'Show sidebar')
    : (isOpen ? 'Hide info panel' : 'Show info panel');

  const Icon = direction === 'left'
    ? (isOpen ? PanelLeftCloseIcon : PanelLeftOpenIcon)
    : (isOpen ? PanelRightCloseIcon : PanelRightOpenIcon);

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 group relative',
        className
      )}
      aria-label={label || defaultLabel}
      aria-expanded={isOpen}
    >
      <Icon className="text-gray-500" />
      {/* Tooltip */}
      <span className="absolute hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 top-full mt-1 left-1/2 -translate-x-1/2">
        {label || defaultLabel}
      </span>
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
