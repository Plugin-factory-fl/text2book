'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mockUser } from '@/data/mock-data';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/bookings', label: 'Bookings' },
  { href: '/dashboard/conversations', label: 'Conversations' },
  { href: '/dashboard/services', label: 'Services' },
  { href: '/dashboard/hours', label: 'Hours' },
  { href: '/dashboard/faqs', label: 'FAQs' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/billing', label: 'Billing' },
];

export function DemoNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const normalizedPathname = pathname.replace(/\/$/, '');
    const normalizedHref = href.replace(/\/$/, '');
    return normalizedPathname === normalizedHref;
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                Text2Book
              </Link>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                DEMO
              </span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md',
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {mockUser.name}
            </span>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Exit Demo
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile nav */}
      <div className="sm:hidden border-t border-gray-200">
        <div className="flex overflow-x-auto px-4 py-2 space-x-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-shrink-0 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap',
                isActive(item.href)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
