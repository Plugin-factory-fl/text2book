# Text2Book

Text2Book is a self serve SaaS for solo appointment based service providers (hair, nails, lashes, massage, trainers, groomers, tutors, detailers, cleaners). Each customer gets a dedicated Twilio phone number. Clients text it; an AI agent converses, checks real availability on the connected Google Calendar, books, sends confirmations and reminders, and answers FAQs.

## Features

### Implemented (MVP)

- **Email/Password Authentication**: Secure user registration and login
- **Onboarding Wizard**: Complete business setup in under 10 minutes
  - Business info collection
  - Google Calendar OAuth connection
  - Service catalog setup (name, duration, price)
  - Weekly availability/hours configuration
  - Optional FAQ setup
  - Twilio phone number provisioning
- **AI Conversation Engine**: 
  - Natural language booking via SMS
  - Service selection and time preference handling
  - Real time availability checking against calendar
  - Booking confirmation
  - FAQ answering from configured responses
  - Escalation handling ("I will have the owner get back to you")
- **Google Calendar Integration**:
  - OAuth 2.0 connection
  - Two way sync (read availability, create events)
  - Automatic calendar event creation on booking
- **Booking Engine**:
  - Double booking prevention
  - Service duration validation
  - Availability rule checking
  - Calendar conflict detection
- **SMS Communications**:
  - Twilio webhook handler
  - Automatic booking confirmations
  - Scheduled reminder texts
  - SMS cap per month (soft limit)
- **Dashboard**:
  - Overview with upcoming bookings and recent conversations
  - Bookings management (view, cancel, complete)
  - Services CRUD
  - Business hours configuration
  - FAQs management
  - Conversation history viewer
  - Settings (business info, calendar connection)
  - Billing (Stripe subscription management)
- **Stripe Billing**:
  - $19.99/month subscription
  - 7 day free trial
  - Checkout session creation
  - Customer portal for payment management
  - Webhook handling for subscription events
  - Easy cancellation

### Stubbed/Partial

- SMS cap enforcement (tracking implemented, hard block not enforced)
- Calendar event updates/deletions on booking changes
- Rescheduling flow in AI conversation (basic support)
- Advanced date parsing (works for common formats)
- Error recovery in AI conversation

### Out of Scope

- Voice calls
- Multi staff support
- Payment/deposit collection
- Client facing booking page
- Advanced analytics
- White label
- Native mobile apps

## Tech Stack

- **Frontend**: Next.js 16 with App Router, React, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider
- **AI**: OpenAI GPT 4o for conversation handling
- **SMS**: Twilio
- **Calendar**: Google Calendar API
- **Payments**: Stripe

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/text2book?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Twilio
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"

# Google OAuth (for Calendar)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Stripe
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
STRIPE_PRICE_ID="your-stripe-price-id"

# App
APP_URL="http://localhost:3000"
TRIAL_DAYS="7"
CRON_SECRET="your-cron-secret"
```

### Getting API Keys

1. **Twilio**: Sign up at twilio.com, get Account SID and Auth Token from console
2. **Google OAuth**: 
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Set redirect URI to `{APP_URL}/api/calendar/callback`
   - Enable Google Calendar API
3. **OpenAI**: Get API key from platform.openai.com
4. **Stripe**: 
   - Get keys from Stripe Dashboard
   - Create a $19.99/month recurring price
   - Set up webhook endpoint at `{APP_URL}/api/webhooks/stripe`

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd text2book
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

4. Generate Prisma client and push schema:
```bash
npm run db:generate
npm run db:push
```

5. Start development server:
```bash
npm run dev
```

6. Open http://localhost:3000

### Testing

Run the test suite:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

Watch mode:
```bash
npm run test:watch
```

### Database Commands

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations (production)
npm run db:studio    # Open Prisma Studio
```

## Deployment

### Render

1. Create a new Web Service from the repository
2. Set build command: `npm install && npm run db:generate && npm run build`
3. Set start command: `npm start`
4. Add all environment variables
5. Create a PostgreSQL database and link it
6. Set up a Cron Job for `/api/cron/reminders` (every 15 minutes)

### Environment Notes

- The app binds to `0.0.0.0:$PORT` as required by Render
- Filesystem is ephemeral; all data is in PostgreSQL
- Set `APP_URL` to your production URL for OAuth callbacks

## API Endpoints

### Public

- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth routes

### Webhooks

- `POST /api/webhooks/twilio` - Twilio SMS webhook
- `POST /api/webhooks/stripe` - Stripe subscription webhook

### Authenticated (Dashboard)

- `GET/POST/PATCH /api/business` - Business CRUD
- `GET/POST /api/services` - Services list/create
- `GET/PATCH/DELETE /api/services/[id]` - Service CRUD
- `GET/POST/PUT /api/availability` - Availability rules
- `GET/POST /api/faqs` - FAQs list/create
- `PATCH/DELETE /api/faqs/[id]` - FAQ CRUD
- `GET /api/bookings` - List bookings
- `GET/PATCH /api/bookings/[id]` - Booking detail/update
- `GET /api/conversations` - List conversations
- `GET /api/conversations/[id]` - Conversation detail
- `GET /api/calendar/connect` - Initiate Google OAuth
- `GET /api/calendar/callback` - OAuth callback
- `GET /api/phone/available` - Search available numbers
- `POST /api/phone/provision` - Provision phone number
- `POST /api/billing/checkout` - Create Stripe checkout
- `POST /api/billing/portal` - Open Stripe portal
- `POST /api/billing/cancel` - Cancel subscription

### Cron

- `GET/POST /api/cron/reminders` - Process scheduled reminders

## Architecture

```
src/
├── app/
│   ├── (auth)/           # Login, register pages
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── api/              # API routes
│   ├── onboarding/       # Onboarding wizard
│   └── page.tsx          # Landing page
├── components/
│   ├── ui/               # Reusable UI components
│   └── dashboard/        # Dashboard specific components
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utility functions
├── prompts/
│   └── booking-assistant.ts  # AI prompt templates
├── services/
│   ├── ai-conversation.ts    # AI conversation handler
│   ├── booking.ts            # Booking logic
│   ├── calendar.ts           # Google Calendar integration
│   ├── reminders.ts          # Reminder processing
│   ├── stripe.ts             # Stripe integration
│   └── twilio.ts             # Twilio SMS
└── types/
    └── next-auth.d.ts    # NextAuth type extensions
```

## License

Proprietary
