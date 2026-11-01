'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium mb-8">
            Interactive Demo Preview
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Text2Book
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI powered SMS booking assistant for solo service providers.
            Let your clients book appointments by text message.
          </p>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Demo Business: Jane&apos;s Hair Studio
            </h2>
            <p className="text-gray-600 mb-6">
              Explore the owner dashboard with sample data. See how bookings, 
              conversations, services, hours, and billing management work.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-left">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">8</p>
                <p className="text-sm text-gray-600">Upcoming Bookings</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">15</p>
                <p className="text-sm text-gray-600">Conversations</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">5</p>
                <p className="text-sm text-gray-600">Services</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">Active</p>
                <p className="text-sm text-gray-600">Subscription</p>
              </div>
            </div>

            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto">
                Enter Demo Dashboard
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Onboarding Preview
            </h2>
            <p className="text-gray-600 mb-6">
              See what new users experience when setting up their business,
              connecting Google Calendar, and configuring services.
            </p>
            <Link href="/onboarding">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View Onboarding Wizard
              </Button>
            </Link>
          </div>

          <div className="mt-12 text-sm text-gray-500">
            <p>
              This is a static demo preview. All data is sample data.
              No actual bookings or messages will be sent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
