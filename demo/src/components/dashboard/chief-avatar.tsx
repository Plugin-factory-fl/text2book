'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ChiefAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-10 h-10', image: 32, badge: 'w-5 h-5 -top-0.5 -right-0.5 text-xs' },
  md: { container: 'w-14 h-14', image: 48, badge: 'w-6 h-6 -top-0.5 -right-0.5 text-sm' },
  lg: { container: 'w-20 h-20', image: 72, badge: 'w-7 h-7 -top-1 -right-1 text-sm' },
};

export function ChiefAvatar({ size = 'lg', showBadge = true, className }: ChiefAvatarProps) {
  const { container, image, badge } = sizeMap[size];

  return (
    <div className={cn('relative', className)}>
      {/* Animated border container */}
      <div className={cn('chief-avatar-glow relative rounded-full', container)}>
        {/* Conic gradient spinning border */}
        <div className="chief-avatar-border absolute inset-0 rounded-full" />
        
        {/* Inner container with image */}
        <div className="absolute inset-[3px] rounded-full bg-white overflow-hidden">
          <picture>
            <source
              srcSet="/images/chief-avatar.webp 1x, /images/chief-avatar@2x.webp 2x"
              type="image/webp"
            />
            <source
              srcSet="/images/chief-avatar.jpg 1x, /images/chief-avatar@2x.jpg 2x"
              type="image/jpeg"
            />
            <Image
              src="/images/chief-avatar.jpg"
              alt="Chief Assistant"
              width={image}
              height={image}
              className="w-full h-full object-cover"
              priority
            />
          </picture>
        </div>
      </div>

      {/* Star badge */}
      {showBadge && (
        <div
          className={cn(
            'absolute bg-yellow-400 rounded-full flex items-center justify-center shadow-md border-2 border-white',
            badge
          )}
        >
          <span>⭐</span>
        </div>
      )}

      {/* CSS for animation */}
      <style jsx>{`
        .chief-avatar-border {
          background: conic-gradient(
            from 0deg,
            #3b82f6,
            #8b5cf6,
            #6366f1,
            #3b82f6
          );
          animation: chief-spin 3.5s ease-in-out infinite;
        }

        .chief-avatar-glow {
          filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.3));
        }

        @keyframes chief-spin {
          0% {
            transform: rotate(0deg);
          }
          80% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .chief-avatar-border {
            animation: none;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6, #6366f1);
          }
        }
      `}</style>
    </div>
  );
}
