'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname.replace(/\/$/, '') === '/dashboard';

  return (
    <main
      className={cn(
        'flex-1 min-h-0 w-full',
        isOverview
          ? 'overflow-hidden p-3'
          : 'overflow-y-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
      )}
    >
      {children}
    </main>
  );
}
