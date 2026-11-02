-- Feature batch: in-person payments, tiers, waitlist, YES holds, audit, missed call

-- Business settings
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "missedCallTextBackEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "missedCallMessage" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "ownerForwardPhone" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "waitlistOfferMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "yesConfirmMinutes" INTEGER NOT NULL DEFAULT 60;

-- Booking payment + YES confirmation
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "remainderAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "remainderPaidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentPromptSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "createdByAi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "yesConfirmRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "yesConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "yesConfirmExpiresAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "yesConfirmReminderSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderConfirmSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderYesAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Booking_yesConfirmExpiresAt_idx" ON "Booking"("yesConfirmExpiresAt");

-- Subscription tier
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'STARTER';

-- Payment records
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT,
    "clientPhone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentRecord_businessId_idx" ON "PaymentRecord"("businessId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_bookingId_idx" ON "PaymentRecord"("bookingId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_clientPhone_idx" ON "PaymentRecord"("clientPhone");

-- Usage periods
CREATE TABLE IF NOT EXISTS "UsagePeriod" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "inboundSegments" INTEGER NOT NULL DEFAULT 0,
    "outboundSegments" INTEGER NOT NULL DEFAULT 0,
    "warnSent" BOOLEAN NOT NULL DEFAULT false,
    "capNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UsagePeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsagePeriod_businessId_periodStart_key" ON "UsagePeriod"("businessId", "periodStart");
CREATE INDEX IF NOT EXISTS "UsagePeriod_businessId_idx" ON "UsagePeriod"("businessId");

-- Waitlist
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientName" TEXT,
    "serviceId" TEXT,
    "serviceName" TEXT,
    "preferredDate" TIMESTAMP(3),
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "offeredStartTime" TIMESTAMP(3),
    "offeredEndTime" TIMESTAMP(3),
    "offerExpiresAt" TIMESTAMP(3),
    "offeredBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaitlistEntry_businessId_status_idx" ON "WaitlistEntry"("businessId", "status");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPhone_idx" ON "WaitlistEntry"("clientPhone");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_offerExpiresAt_idx" ON "WaitlistEntry"("offerExpiresAt");

-- Audit log
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientPhone" TEXT,
    "bookingId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_businessId_idx" ON "AuditLog"("businessId");
CREATE INDEX IF NOT EXISTS "AuditLog_clientPhone_idx" ON "AuditLog"("clientPhone");
CREATE INDEX IF NOT EXISTS "AuditLog_bookingId_idx" ON "AuditLog"("bookingId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Owner notifications (Chief chat prompts)
CREATE TABLE IF NOT EXISTS "OwnerNotification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "clientPhone" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "draftFollowup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "OwnerNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OwnerNotification_businessId_status_idx" ON "OwnerNotification"("businessId", "status");
CREATE INDEX IF NOT EXISTS "OwnerNotification_type_idx" ON "OwnerNotification"("type");

-- Foreign keys (ignore if already present)
DO $$ BEGIN
  ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UsagePeriod" ADD CONSTRAINT "UsagePeriod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OwnerNotification" ADD CONSTRAINT "OwnerNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
