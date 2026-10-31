export const mockUser = {
  name: 'Sarah Johnson',
  email: 'sarah@janeshairsalon.com',
};

export const mockBusiness = {
  id: 'demo-business-1',
  name: "Jane's Hair Studio",
  category: 'Hair Salon',
  phone: '(555) 123-4567',
  address: '123 Main Street',
  city: 'San Francisco',
  state: 'CA',
  timezone: 'America/Los_Angeles',
  reminderHoursBefore: 24,
  phoneNumber: {
    phoneNumber: '+15551234567',
    monthlySmsSent: 127,
    monthlySmsCap: 500,
  },
  _count: {
    bookings: 8,
    conversations: 15,
  },
};

export const mockServices = [
  {
    id: 'svc-1',
    name: "Women's Haircut",
    description: 'Full haircut including wash, cut, and style',
    duration: 60,
    price: 65,
    isActive: true,
  },
  {
    id: 'svc-2',
    name: "Men's Haircut",
    description: 'Classic cut with clippers and scissors',
    duration: 30,
    price: 35,
    isActive: true,
  },
  {
    id: 'svc-3',
    name: 'Color Treatment',
    description: 'Single process color application',
    duration: 120,
    price: 150,
    isActive: true,
  },
  {
    id: 'svc-4',
    name: 'Highlights',
    description: 'Partial or full highlights',
    duration: 150,
    price: 200,
    isActive: true,
  },
  {
    id: 'svc-5',
    name: 'Blowout',
    description: 'Wash and blowdry styling',
    duration: 45,
    price: 45,
    isActive: true,
  },
];

export const mockAvailability = {
  0: { enabled: false, start: '09:00', end: '17:00' },
  1: { enabled: true, start: '09:00', end: '18:00' },
  2: { enabled: true, start: '09:00', end: '18:00' },
  3: { enabled: true, start: '09:00', end: '18:00' },
  4: { enabled: true, start: '09:00', end: '20:00' },
  5: { enabled: true, start: '09:00', end: '20:00' },
  6: { enabled: true, start: '10:00', end: '16:00' },
};

export const mockFaqs = [
  {
    id: 'faq-1',
    question: 'Where are you located?',
    answer: 'We are located at 123 Main Street in downtown San Francisco, between 2nd and 3rd Avenue. Street parking is available.',
  },
  {
    id: 'faq-2',
    question: 'Do you accept walk ins?',
    answer: 'We prefer appointments but we do accept walk ins when available. For best results, please book ahead via text!',
  },
  {
    id: 'faq-3',
    question: 'What is your cancellation policy?',
    answer: 'We ask for at least 24 hours notice for cancellations. Late cancellations may be subject to a $25 fee.',
  },
  {
    id: 'faq-4',
    question: 'Do you offer gift cards?',
    answer: 'Yes! Gift cards are available in any amount. Just ask your stylist or text us to purchase.',
  },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 7);

export const mockBookings = [
  {
    id: 'booking-1',
    clientName: 'Emily Chen',
    clientPhone: '+15559876543',
    clientEmail: 'emily.chen@email.com',
    serviceName: "Women's Haircut",
    duration: 60,
    price: 65,
    startTime: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
    endTime: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
    status: 'CONFIRMED',
    notes: 'First time client, referred by Maria',
    confirmationSent: true,
    reminderSent: false,
  },
  {
    id: 'booking-2',
    clientName: 'Michael Rodriguez',
    clientPhone: '+15558765432',
    clientEmail: null,
    serviceName: "Men's Haircut",
    duration: 30,
    price: 35,
    startTime: new Date(tomorrow.setHours(11, 30, 0, 0)).toISOString(),
    endTime: new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString(),
    status: 'CONFIRMED',
    notes: null,
    confirmationSent: true,
    reminderSent: false,
  },
  {
    id: 'booking-3',
    clientName: 'Jessica Williams',
    clientPhone: '+15557654321',
    clientEmail: 'jess.w@email.com',
    serviceName: 'Color Treatment',
    duration: 120,
    price: 150,
    startTime: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
    endTime: new Date(tomorrow.setHours(16, 0, 0, 0)).toISOString(),
    status: 'CONFIRMED',
    notes: 'Wants to go darker for winter',
    confirmationSent: true,
    reminderSent: false,
  },
  {
    id: 'booking-4',
    clientName: 'Amanda Taylor',
    clientPhone: '+15556543210',
    clientEmail: 'amanda.t@email.com',
    serviceName: 'Highlights',
    duration: 150,
    price: 200,
    startTime: new Date(nextWeek.setHours(10, 0, 0, 0)).toISOString(),
    endTime: new Date(nextWeek.setHours(12, 30, 0, 0)).toISOString(),
    status: 'CONFIRMED',
    notes: null,
    confirmationSent: true,
    reminderSent: false,
  },
  {
    id: 'booking-5',
    clientName: 'David Kim',
    clientPhone: '+15555432109',
    clientEmail: null,
    serviceName: "Men's Haircut",
    duration: 30,
    price: 35,
    startTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString(),
    status: 'COMPLETED',
    notes: null,
    confirmationSent: true,
    reminderSent: true,
  },
  {
    id: 'booking-6',
    clientName: 'Lisa Brown',
    clientPhone: '+15554321098',
    clientEmail: 'lisa.brown@email.com',
    serviceName: 'Blowout',
    duration: 45,
    price: 45,
    startTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 5 + 2700000).toISOString(),
    status: 'CANCELLED',
    notes: 'Client cancelled due to illness',
    confirmationSent: true,
    reminderSent: false,
  },
];

export const mockConversations = [
  {
    id: 'conv-1',
    clientPhone: '+15559876543',
    clientName: 'Emily Chen',
    state: 'BOOKING_CONFIRMED',
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      {
        id: 'msg-1',
        direction: 'INBOUND' as const,
        content: 'Hi! I would like to book a haircut please',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'msg-2',
        direction: 'OUTBOUND' as const,
        content: "Hi Emily! I'd be happy to help you book a haircut at Jane's Hair Studio. We offer Women's Haircut (60 min, $65) and Men's Haircut (30 min, $35). Which would you prefer?",
        createdAt: new Date(Date.now() - 7100000).toISOString(),
      },
      {
        id: 'msg-3',
        direction: 'INBOUND' as const,
        content: "Women's haircut please",
        createdAt: new Date(Date.now() - 6900000).toISOString(),
      },
      {
        id: 'msg-4',
        direction: 'OUTBOUND' as const,
        content: "Great choice! When would you like to come in? I have openings tomorrow at 10am, 2pm, and 4pm. Or I can check other days if you'd prefer.",
        createdAt: new Date(Date.now() - 6800000).toISOString(),
      },
      {
        id: 'msg-5',
        direction: 'INBOUND' as const,
        content: 'Tomorrow at 10am works!',
        createdAt: new Date(Date.now() - 6600000).toISOString(),
      },
      {
        id: 'msg-6',
        direction: 'OUTBOUND' as const,
        content: "Perfect! I've booked you for a Women's Haircut tomorrow at 10:00 AM. You'll receive a reminder text 24 hours before. See you then!",
        createdAt: new Date(Date.now() - 6500000).toISOString(),
      },
      {
        id: 'msg-7',
        direction: 'INBOUND' as const,
        content: 'Thank you so much!',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    bookings: [mockBookings[0]],
  },
  {
    id: 'conv-2',
    clientPhone: '+15558765432',
    clientName: 'Michael Rodriguez',
    state: 'BOOKING_CONFIRMED',
    lastActivity: new Date(Date.now() - 86400000).toISOString(),
    messages: [
      {
        id: 'msg-10',
        direction: 'INBOUND' as const,
        content: 'Need a haircut tomorrow',
        createdAt: new Date(Date.now() - 90000000).toISOString(),
      },
      {
        id: 'msg-11',
        direction: 'OUTBOUND' as const,
        content: "Hi Michael! I can help you book a Men's Haircut for tomorrow. I have 11:30 AM and 3 PM available. Which works better?",
        createdAt: new Date(Date.now() - 89900000).toISOString(),
      },
      {
        id: 'msg-12',
        direction: 'INBOUND' as const,
        content: '11:30 please',
        createdAt: new Date(Date.now() - 89700000).toISOString(),
      },
      {
        id: 'msg-13',
        direction: 'OUTBOUND' as const,
        content: "Done! You're booked for a Men's Haircut tomorrow at 11:30 AM. See you then!",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    bookings: [mockBookings[1]],
  },
  {
    id: 'conv-3',
    clientPhone: '+15557654321',
    clientName: 'Jessica Williams',
    state: 'BOOKING_CONFIRMED',
    lastActivity: new Date(Date.now() - 172800000).toISOString(),
    messages: [
      {
        id: 'msg-20',
        direction: 'INBOUND' as const,
        content: 'Hi, do you do hair coloring?',
        createdAt: new Date(Date.now() - 180000000).toISOString(),
      },
      {
        id: 'msg-21',
        direction: 'OUTBOUND' as const,
        content: "Yes! We offer Color Treatment ($150, 2 hours) and Highlights ($200, 2.5 hours). Would either of these interest you?",
        createdAt: new Date(Date.now() - 179900000).toISOString(),
      },
      {
        id: 'msg-22',
        direction: 'INBOUND' as const,
        content: 'Color treatment. I want to go darker for winter',
        createdAt: new Date(Date.now() - 179700000).toISOString(),
      },
      {
        id: 'msg-23',
        direction: 'OUTBOUND' as const,
        content: "That sounds lovely! I have tomorrow at 2 PM available for a Color Treatment. Would that work?",
        createdAt: new Date(Date.now() - 179600000).toISOString(),
      },
      {
        id: 'msg-24',
        direction: 'INBOUND' as const,
        content: 'Yes perfect!',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 'msg-25',
        direction: 'OUTBOUND' as const,
        content: "Wonderful! You're booked for a Color Treatment tomorrow at 2:00 PM. I've noted you want to go darker. See you soon!",
        createdAt: new Date(Date.now() - 172700000).toISOString(),
      },
    ],
    bookings: [mockBookings[2]],
  },
  {
    id: 'conv-4',
    clientPhone: '+15556543210',
    clientName: 'Amanda Taylor',
    state: 'FAQ_ANSWERED',
    lastActivity: new Date(Date.now() - 259200000).toISOString(),
    messages: [
      {
        id: 'msg-30',
        direction: 'INBOUND' as const,
        content: 'Where are you located?',
        createdAt: new Date(Date.now() - 260000000).toISOString(),
      },
      {
        id: 'msg-31',
        direction: 'OUTBOUND' as const,
        content: "We're located at 123 Main Street in downtown San Francisco, between 2nd and 3rd Avenue. Street parking is available. Would you like to book an appointment?",
        createdAt: new Date(Date.now() - 259200000).toISOString(),
      },
    ],
    bookings: [],
  },
  {
    id: 'conv-5',
    clientPhone: '+15555432109',
    clientName: 'David Kim',
    state: 'BOOKING_CONFIRMED',
    lastActivity: new Date(Date.now() - 345600000).toISOString(),
    messages: [
      {
        id: 'msg-40',
        direction: 'INBOUND' as const,
        content: 'Haircut at 3pm today?',
        createdAt: new Date(Date.now() - 350000000).toISOString(),
      },
      {
        id: 'msg-41',
        direction: 'OUTBOUND' as const,
        content: "Hi David! Unfortunately 3pm is booked. I have 4pm available. Would that work?",
        createdAt: new Date(Date.now() - 349900000).toISOString(),
      },
      {
        id: 'msg-42',
        direction: 'INBOUND' as const,
        content: 'Sure',
        createdAt: new Date(Date.now() - 349700000).toISOString(),
      },
      {
        id: 'msg-43',
        direction: 'OUTBOUND' as const,
        content: "Great! You're booked for a Men's Haircut today at 4:00 PM. See you soon!",
        createdAt: new Date(Date.now() - 345600000).toISOString(),
      },
    ],
    bookings: [mockBookings[4]],
  },
];

export const mockSubscription = {
  status: 'ACTIVE',
  currentPeriodStart: new Date(Date.now() - 86400000 * 15).toISOString(),
  currentPeriodEnd: new Date(Date.now() + 86400000 * 15).toISOString(),
  trialEnd: null,
};
