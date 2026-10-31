import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { handleDepositPaymentSuccess, handleDepositSessionExpired } from './stripe-connect';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('Stripe secret key not configured');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function createCheckoutSession(
  userId: string,
  email: string
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return { error: 'Stripe price ID not configured' };
  }

  let subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;

    if (subscription) {
      await prisma.subscription.update({
        where: { userId },
        data: { stripeCustomerId: customerId },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: customerId,
          status: 'INCOMPLETE',
        },
      });
    }
  }

  const trialDays = parseInt(process.env.TRIAL_DAYS || '7', 10);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: trialDays,
    },
    success_url: `${process.env.APP_URL}/dashboard?subscription=success`,
    cancel_url: `${process.env.APP_URL}/dashboard/billing?subscription=cancelled`,
    metadata: { userId },
  });

  if (!session.url) {
    return { error: 'Failed to create checkout session' };
  }

  return { url: session.url };
}

export async function createPortalSession(
  userId: string
): Promise<{ url: string } | { error: string }> {
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeCustomerId) {
    return { error: 'No subscription found' };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.APP_URL}/dashboard/billing`,
  });

  return { url: session.url };
}

export async function handleWebhookEvent(
  payload: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { success: false, error: 'Webhook secret not configured' };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return { success: false, error: 'Invalid signature' };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'deposit' && session.metadata?.platform === 'text2book') {
        await handleDepositPaymentSuccess(session.id);
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'deposit' && session.metadata?.platform === 'text2book') {
        await handleDepositSessionExpired(session.id);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await updateSubscriptionFromStripe(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELLED' },
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceSubscription = (invoice as { subscription?: string | Stripe.Subscription }).subscription;
      if (invoiceSubscription) {
        const subscriptionId = typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription.id;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'ACTIVE' },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceSubscription = (invoice as { subscription?: string | Stripe.Subscription }).subscription;
      if (invoiceSubscription) {
        const subscriptionId = typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription.id;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { success: true };
}

async function updateSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
  const customerId = stripeSubscription.customer as string;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSubscription) {
    console.warn(`No subscription found for customer: ${customerId}`);
    return;
  }

  let status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE';
  
  switch (stripeSubscription.status) {
    case 'trialing':
      status = 'TRIAL';
      break;
    case 'active':
      status = 'ACTIVE';
      break;
    case 'past_due':
      status = 'PAST_DUE';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'CANCELLED';
      break;
    default:
      status = 'INCOMPLETE';
  }

  const subscriptionAny = stripeSubscription as {
    current_period_start?: number;
    current_period_end?: number;
  };

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.items.data[0]?.price.id,
      status,
      trialEndsAt: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      currentPeriodStart: subscriptionAny.current_period_start
        ? new Date(subscriptionAny.current_period_start * 1000)
        : null,
      currentPeriodEnd: subscriptionAny.current_period_end
        ? new Date(subscriptionAny.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });
}

export async function cancelSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeSubscriptionId) {
    return { success: false, error: 'No active subscription found' };
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });

  return { success: true };
}
