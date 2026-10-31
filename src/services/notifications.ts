import prisma from '@/lib/prisma';

export type NotificationType = 'SMS_CAP_WARNING' | 'SMS_CAP_REACHED';

export async function shouldSendNotification(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const recentNotification = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  return true;
}

export async function notifyOwnerSmsCap(
  businessId: string,
  type: 'warning' | 'reached',
  currentCount: number,
  cap: number
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { user: true },
  });

  if (!business || !business.user.email) {
    return;
  }

  const percentUsed = Math.round((currentCount / cap) * 100);
  
  console.log(
    `SMS Cap ${type === 'warning' ? 'Warning' : 'Reached'} for ${business.name}: ` +
    `${currentCount}/${cap} (${percentUsed}%) - Owner: ${business.user.email}`
  );
}

export async function getSmsCounts(businessId: string): Promise<{
  sent: number;
  cap: number;
  percentUsed: number;
}> {
  const phoneNumber = await prisma.phoneNumber.findUnique({
    where: { businessId },
  });

  if (!phoneNumber) {
    return { sent: 0, cap: 500, percentUsed: 0 };
  }

  const percentUsed = Math.round((phoneNumber.monthlySmsSent / phoneNumber.monthlySmsCap) * 100);

  return {
    sent: phoneNumber.monthlySmsSent,
    cap: phoneNumber.monthlySmsCap,
    percentUsed,
  };
}
