import Stripe from 'stripe';
import prisma from '@/lib/prisma';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('Stripe secret key not configured');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function createConnectedAccount(
  businessId: string,
  email: string
): Promise<{ accountId: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    return { error: 'Business not found' };
  }

  if (business.stripeAccountId) {
    return { accountId: business.stripeAccountId };
  }

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        businessId,
        platform: 'text2book',
      },
    });

    await prisma.business.update({
      where: { id: businessId },
      data: { stripeAccountId: account.id },
    });

    return { accountId: account.id };
  } catch (error) {
    console.error('Failed to create connected account:', error);
    return { error: 'Failed to create payment account' };
  }
}

export async function createAccountOnboardingLink(
  businessId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business?.stripeAccountId) {
    return { error: 'No payment account found' };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: business.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  } catch (error) {
    console.error('Failed to create account link:', error);
    return { error: 'Failed to create onboarding link' };
  }
}

export async function createAccountLoginLink(
  businessId: string
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business?.stripeAccountId) {
    return { error: 'No payment account found' };
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(
      business.stripeAccountId
    );

    return { url: loginLink.url };
  } catch (error) {
    console.error('Failed to create login link:', error);
    return { error: 'Failed to create dashboard link' };
  }
}

export async function getAccountStatus(
  businessId: string
): Promise<{
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
} | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business?.stripeAccountId) {
    return {
      connected: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(business.stripeAccountId);

    const isComplete = account.details_submitted && 
      (account.charges_enabled ?? false) && 
      (account.payouts_enabled ?? false);

    if (isComplete && !business.stripeOnboardingComplete) {
      await prisma.business.update({
        where: { id: businessId },
        data: { stripeOnboardingComplete: true },
      });
    }

    return {
      connected: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      accountId: business.stripeAccountId,
    };
  } catch (error) {
    console.error('Failed to get account status:', error);
    return { error: 'Failed to get account status' };
  }
}

export interface DepositCheckoutParams {
  bookingId: string;
  businessId: string;
  amount: number;
  clientPhone: string;
  serviceName: string;
  businessName: string;
}

export async function createDepositCheckoutSession(
  params: DepositCheckoutParams
): Promise<{ url: string; sessionId: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const { bookingId, businessId, amount, clientPhone, serviceName, businessName } = params;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business?.stripeAccountId || !business.stripeOnboardingComplete) {
    return { error: 'Business is not set up to receive payments' };
  }

  const platformFeeAmount = Math.round(amount * (business.platformFeePercent / 100));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Deposit for ${serviceName}`,
              description: `Booking deposit at ${businessName}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeAmount > 0 ? platformFeeAmount : undefined,
        transfer_data: {
          destination: business.stripeAccountId,
        },
        metadata: {
          bookingId,
          businessId,
          type: 'deposit',
          platform: 'text2book',
        },
      },
      metadata: {
        bookingId,
        businessId,
        clientPhone,
        type: 'deposit',
        platform: 'text2book',
      },
      success_url: `${process.env.APP_URL}/deposit/success?booking=${bookingId}`,
      cancel_url: `${process.env.APP_URL}/deposit/cancel?booking=${bookingId}`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    await prisma.depositPayment.upsert({
      where: { bookingId },
      update: {
        stripeCheckoutSessionId: session.id,
        amount,
        status: 'pending',
      },
      create: {
        bookingId,
        stripeCheckoutSessionId: session.id,
        amount,
        status: 'pending',
      },
    });

    return { url: session.url!, sessionId: session.id };
  } catch (error) {
    console.error('Failed to create deposit checkout session:', error);
    return { error: 'Failed to create payment link' };
  }
}

export async function handleDepositPaymentSuccess(
  sessionId: string
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.metadata?.type !== 'deposit' || session.metadata?.platform !== 'text2book') {
      return { success: false, error: 'Not a Text2Book deposit session' };
    }

    const bookingId = session.metadata.bookingId;
    if (!bookingId) {
      return { success: false, error: 'Missing booking ID' };
    }

    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id;

    await prisma.$transaction(async (tx) => {
      await tx.depositPayment.update({
        where: { bookingId },
        data: {
          status: 'paid',
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          depositStatus: 'PAID',
          depositPaidAt: new Date(),
        },
      });
    });

    return { success: true, bookingId };
  } catch (error) {
    console.error('Failed to handle deposit payment success:', error);
    return { success: false, error: 'Failed to process payment' };
  }
}

export async function handleDepositSessionExpired(
  sessionId: string
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.metadata?.type !== 'deposit' || session.metadata?.platform !== 'text2book') {
      return { success: false, error: 'Not a Text2Book deposit session' };
    }

    const bookingId = session.metadata.bookingId;
    if (!bookingId) {
      return { success: false, error: 'Missing booking ID' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.status !== 'AWAITING_DEPOSIT') {
      return { success: true, bookingId };
    }

    await prisma.$transaction(async (tx) => {
      await tx.depositPayment.update({
        where: { bookingId },
        data: { status: 'expired' },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          depositStatus: 'EXPIRED',
          notes: 'Cancelled: deposit payment not received',
        },
      });
    });

    return { success: true, bookingId };
  } catch (error) {
    console.error('Failed to handle deposit session expiration:', error);
    return { success: false, error: 'Failed to process expiration' };
  }
}

export async function isClientTrusted(
  businessId: string,
  phone: string
): Promise<boolean> {
  const normalized = phone.replace(/\D/g, '');
  
  const trustedClient = await prisma.trustedClient.findFirst({
    where: {
      businessId,
      phone: { contains: normalized.slice(-10) },
    },
  });

  return !!trustedClient;
}

export async function getDepositAmountForService(
  businessId: string,
  serviceId: string | null
): Promise<number | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business || !business.depositsEnabled) {
    return null;
  }

  if (!business.stripeAccountId || !business.stripeOnboardingComplete) {
    return null;
  }

  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (service?.depositOverride !== null && service?.depositOverride !== undefined) {
      return service.depositOverride === 0 ? null : service.depositOverride;
    }
  }

  return business.defaultDepositAmount;
}
