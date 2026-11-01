import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DashboardClient } from './dashboard-client';

function DashboardLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-500">
        <p className="text-lg">Loading dashboard...</p>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.business?.onboardingComplete) {
    redirect('/onboarding');
  }

  const business = await prisma.business.findUnique({
    where: { id: user.business.id },
    include: {
      phoneNumber: true,
    },
  });

  const conversations = await prisma.conversation.findMany({
    where: { businessId: user.business.id },
    orderBy: { lastActivity: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      bookings: {
        where: {
          OR: [
            { status: 'CONFIRMED' },
            { status: 'AWAITING_DEPOSIT' },
          ],
        },
        orderBy: { startTime: 'asc' },
      },
      internalNotes: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const trustedClients = await prisma.trustedClient.findMany({
    where: { businessId: user.business.id },
  });

  const trustedPhones = new Set(
    trustedClients.map((tc) => tc.phone.slice(-10))
  );

  const conversationsWithTrusted = conversations.map((conv) => ({
    ...conv,
    isTrusted: trustedPhones.has(conv.clientPhone.slice(-10)),
    messages: conv.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    bookings: conv.bookings.map((b) => ({
      id: b.id,
      clientName: b.clientName,
      clientPhone: b.clientPhone,
      clientEmail: b.clientEmail,
      serviceName: b.serviceName,
      duration: b.duration,
      price: b.price || 0,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      status: b.status,
      notes: b.notes,
      depositRequired: b.depositRequired,
      depositAmount: b.depositAmount,
      depositStatus: b.depositStatus,
    })),
    internalNotes: conv.internalNotes.map((n) => ({
      id: n.id,
      noteType: n.noteType as 'CONSULT' | 'RESPONSE' | 'ESCALATION' | 'DIRECTIVE' | 'INJECTION_ATTEMPT',
      content: n.content,
      fromAgent: n.fromAgent,
      toAgent: n.toAgent,
      wasFiltered: n.wasFiltered,
      filterReason: n.filterReason,
      createdAt: n.createdAt.toISOString(),
    })),
    lastActivity: conv.lastActivity.toISOString(),
  }));

  const allBookings = await prisma.booking.findMany({
    where: { businessId: user.business.id },
    orderBy: { startTime: 'desc' },
  });

  const bookingsByPhone = allBookings.reduce(
    (acc, booking) => {
      const phone = booking.clientPhone.slice(-10);
      if (!acc[phone]) {
        acc[phone] = [];
      }
      acc[phone].push(booking);
      return acc;
    },
    {} as Record<string, typeof allBookings>
  );

  const clientStats = Object.entries(bookingsByPhone).reduce(
    (acc, [phone, bookings]) => {
      const completed = bookings.filter((b) => b.status === 'COMPLETED');
      const noShows = bookings.filter((b) => b.status === 'NO_SHOW').length;
      const cancellations = bookings.filter((b) => b.status === 'CANCELLED').length;
      const lifetimeRevenue = completed.reduce((sum, b) => sum + (b.price || 0), 0);
      const totalVisits = completed.length;
      const averageSpend = totalVisits > 0 ? lifetimeRevenue / totalVisits : 0;
      const lastVisit = completed.length > 0 ? completed[0].startTime.toISOString() : null;

      acc[phone] = {
        totalVisits,
        lifetimeRevenue,
        noShows,
        cancellations,
        lastVisit,
        averageSpend,
      };
      return acc;
    },
    {} as Record<
      string,
      {
        totalVisits: number;
        lifetimeRevenue: number;
        noShows: number;
        cancellations: number;
        lastVisit: string | null;
        averageSpend: number;
      }
    >
  );

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const allBookingsForMetrics = await prisma.booking.findMany({
    where: { businessId: user.business.id },
  });

  const todayBookings = allBookingsForMetrics.filter(
    (b) => b.startTime >= todayStart && b.startTime <= todayEnd && b.status === 'CONFIRMED'
  ).length;

  const upcomingBookingsCount = allBookingsForMetrics.filter(
    (b) => b.startTime > now && ['CONFIRMED', 'AWAITING_DEPOSIT'].includes(b.status)
  ).length;

  const unpaidDeposits = allBookingsForMetrics.filter(
    (b) => b.depositStatus === 'PENDING'
  ).length;

  const needsAttention = conversations.filter(
    (c) => c.state === 'ESCALATE'
  ).length;

  const activeConversations = conversations.filter(
    (c) => c.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  const metrics = {
    totalClients: conversations.length,
    activeConversations,
    conversationsNeedingAttention: needsAttention,
    unpaidDeposits,
    todayBookings,
    upcomingBookings: upcomingBookingsCount,
  };

  const escalationNotes = await prisma.internalNote.findMany({
    where: {
      conversation: { businessId: user.business.id },
      noteType: 'ESCALATION',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { conversation: true },
  });

  const recentEscalations = escalationNotes.map((e) => ({
    conversationId: e.conversationId,
    clientName: e.conversation.clientName,
    clientPhone: e.conversation.clientPhone,
    reason: e.content,
    timestamp: e.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      userName={user.name || 'there'}
      businessName={business?.name || 'your business'}
      phoneNumber={business?.phoneNumber?.phoneNumber || null}
      conversations={conversationsWithTrusted}
      clientStats={clientStats}
      trustedPhones={Array.from(trustedPhones)}
      metrics={metrics}
      recentEscalations={recentEscalations}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
