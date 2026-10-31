# Text2Book Demo

Static demo of the Text2Book owner dashboard for GitHub Pages.

**Live at: https://plugin-factory-fl.github.io/text2book/**

## Pages

- `/` - Demo landing page
- `/dashboard/` - Dashboard overview
- `/dashboard/bookings/` - Bookings management
- `/dashboard/conversations/` - SMS conversation viewer
- `/dashboard/services/` - Service management
- `/dashboard/hours/` - Business hours
- `/dashboard/faqs/` - FAQ management
- `/dashboard/settings/` - Business settings
- `/dashboard/billing/` - Subscription billing
- `/onboarding/` - Onboarding wizard demo

## Development

```bash
cd demo
npm install
npm run dev
```

## Build for GitHub Pages

```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/text2book npm run build
```

Output is in `demo/out/`.
