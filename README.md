# Text2Book

Text2Book is a self serve SaaS for solo appointment based service providers (hair, nails, lashes, massage, trainers, groomers, tutors, detailers, cleaners). Each customer gets a dedicated Twilio phone number. Clients text it; an AI agent converses, checks real availability on the connected Google Calendar, books, sends confirmations and reminders, and answers FAQs.

## Live Demo

**[View the interactive demo](https://plugin-factory-fl.github.io/text2book/)** to explore the owner dashboard with sample data. No login required.

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
  - SMS cap enforcement with owner notification
  - Graceful degradation when cap reached (fallback message to clients)
- **Reschedule and Cancel via SMS**:
  - Natural language reschedule requests
  - Natural language cancel requests
  - Google Calendar event updates on reschedule
  - Google Calendar event deletion on cancel
- **Two Way Calendar Sync**:
  - Hourly sync job detects changes in Google Calendar
  - Auto cancels bookings if calendar event is deleted
  - Handles calendar event time changes
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
4. **Stripe**: See [Stripe Setup](#stripe-setup) below for detailed instructions

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

### Render (Blueprint)

The easiest way to deploy is with the included `render.yaml` Blueprint:

1. Fork or push this repo to GitHub
2. In the Render Dashboard, click **New > Blueprint**
3. Connect your repository and select the branch
4. Render will detect `render.yaml` and create:
   - `text2book-web` - Main Next.js application
   - `text2book-db` - PostgreSQL database
   - `text2book-reminders-cron` - Cron job for reminders (every 15 min)
   - `text2book-calendar-sync-cron` - Cron job for calendar sync (hourly)
5. Configure environment variables (marked `sync: false` in Blueprint):
   - `NEXTAUTH_URL` - Your Render service URL (e.g., `https://text2book-web.onrender.com`)
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `TWILIO_ACCOUNT_SID` - From Twilio Console
   - `TWILIO_AUTH_TOKEN` - From Twilio Console
   - `GOOGLE_CLIENT_ID` - From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
   - `OPENAI_API_KEY` - From OpenAI Platform
   - `STRIPE_SECRET_KEY` - From Stripe Dashboard
   - `STRIPE_PUBLISHABLE_KEY` - From Stripe Dashboard
   - `STRIPE_WEBHOOK_SECRET` - From Stripe webhook endpoint (see below)
   - `STRIPE_PRICE_ID` - Your Text2Book price ID (see below)
   - `APP_URL` - Same as `NEXTAUTH_URL`
   - `CRON_SECRET` - Generate with `openssl rand -base64 32`
6. Deploy

### Manual Render Setup

If you prefer manual setup over the Blueprint:

1. Create a new Web Service from the repository
2. Set build command: `npm install && npm run db:generate && npm run build`
3. Set start command: `npm start`
4. Add all environment variables
5. Create a PostgreSQL database and link it
6. Set up Cron Jobs:
   - Reminders: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders` (every 15 min)
   - Calendar sync: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/calendar-sync` (hourly)

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
- `GET/POST /api/cron/calendar-sync` - Sync bookings with Google Calendar

## Stripe Setup

Text2Book uses Stripe for subscription billing ($19.99/month with 7 day free trial). Follow these steps to set up Stripe:

### 1. Create the Text2Book Product and Price

In the [Stripe Dashboard](https://dashboard.stripe.com):

1. Go to **Products** > **Add product**
2. Create the product:
   - **Name**: Text2Book Monthly Subscription
   - **Description**: AI powered SMS booking assistant for your business
3. Add a price:
   - **Pricing model**: Standard pricing
   - **Price**: $19.99
   - **Billing period**: Monthly (recurring)
4. Save the product
5. Copy the **Price ID** (starts with `price_`) and set it as `STRIPE_PRICE_ID`

### 2. Get API Keys

1. Go to **Developers** > **API keys**
2. Copy the **Publishable key** (starts with `pk_`) to `STRIPE_PUBLISHABLE_KEY`
3. Copy the **Secret key** (starts with `sk_`) to `STRIPE_SECRET_KEY`

For testing, use the test mode keys (toggle "Test mode" in the Dashboard).

### 3. Create the Webhook Endpoint

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`) to `STRIPE_WEBHOOK_SECRET`

### 4. Test Locally with Stripe CLI

For local development, use the Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI will display a webhook signing secret - use it for local testing
# (different from your production webhook secret)
```

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Creates subscription record, activates account |
| `customer.subscription.created` | Records new subscription |
| `customer.subscription.updated` | Updates subscription status (active/canceled/past_due) |
| `customer.subscription.deleted` | Marks subscription as canceled |
| `invoice.payment_succeeded` | Updates subscription period dates |
| `invoice.payment_failed` | Marks subscription as past_due |

### Testing Subscriptions

In test mode, use these test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`

Use any future expiration date and any 3 digit CVC.

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
