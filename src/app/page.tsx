import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Text2Book</h1>
        <div className="space-x-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-20 pb-32 text-center">
        <h2 className="text-5xl font-bold text-gray-900 leading-tight">
          Let clients book by text.
          <br />
          <span className="text-blue-600">You focus on your craft.</span>
        </h2>
        <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
          Your AI booking assistant handles appointment scheduling via SMS. Clients
          text your dedicated number, and bookings appear on your calendar
          automatically.
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700"
          >
            Start 7 Day Free Trial
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          $19.99/month after trial. No credit card required to start.
        </p>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-left p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Text to Book</h3>
            <p className="mt-2 text-gray-600">
              Clients simply text your number. The AI handles scheduling naturally.
            </p>
          </div>

          <div className="text-left p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Calendar Sync</h3>
            <p className="mt-2 text-gray-600">
              Syncs with Google Calendar. Never double book. Automatic updates.
            </p>
          </div>

          <div className="text-left p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Auto Reminders</h3>
            <p className="mt-2 text-gray-600">
              Confirmations and reminders sent automatically. Reduce no shows.
            </p>
          </div>
        </div>

        <div className="mt-20 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Perfect for solo service providers
          </h3>
          <div className="flex flex-wrap justify-center gap-4 text-gray-600">
            <span className="px-4 py-2 bg-gray-100 rounded-full">Hair stylists</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Nail techs</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Massage therapists</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Personal trainers</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Pet groomers</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Tutors</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Cleaners</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full">Auto detailers</span>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          Text2Book. Simple booking for service providers.
        </div>
      </footer>
    </div>
  );
}
