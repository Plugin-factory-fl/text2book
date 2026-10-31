'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber, formatDuration } from '@/lib/utils';

type Step = 'business' | 'calendar' | 'services' | 'hours' | 'faqs' | 'phone' | 'complete';

const STEPS: { key: Step; title: string; description: string }[] = [
  { key: 'business', title: 'Business Info', description: 'Tell us about your business' },
  { key: 'calendar', title: 'Calendar', description: 'Connect your Google Calendar' },
  { key: 'services', title: 'Services', description: 'Add the services you offer' },
  { key: 'hours', title: 'Hours', description: 'Set your business hours' },
  { key: 'faqs', title: 'FAQs', description: 'Add common questions (optional)' },
  { key: 'phone', title: 'Phone Number', description: 'Get your booking number' },
  { key: 'complete', title: 'All Done!', description: 'You are ready to accept bookings' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEMO_NUMBERS = [
  { phoneNumber: '+15551234567', locality: 'San Francisco', region: 'CA' },
  { phoneNumber: '+15559876543', locality: 'San Francisco', region: 'CA' },
  { phoneNumber: '+15552468135', locality: 'Oakland', region: 'CA' },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [isLoading, setIsLoading] = useState(false);

  const [businessData, setBusinessData] = useState({
    name: '',
    category: '',
    phone: '',
    city: '',
    state: '',
  });

  const [calendarConnected, setCalendarConnected] = useState(false);

  const [services, setServices] = useState<Array<{
    name: string;
    duration: number;
    price: string;
  }>>([{ name: '', duration: 60, price: '' }]);

  const [hours, setHours] = useState<Record<number, { enabled: boolean; start: string; end: string }>>({
    0: { enabled: false, start: '09:00', end: '17:00' },
    1: { enabled: true, start: '09:00', end: '17:00' },
    2: { enabled: true, start: '09:00', end: '17:00' },
    3: { enabled: true, start: '09:00', end: '17:00' },
    4: { enabled: true, start: '09:00', end: '17:00' },
    5: { enabled: true, start: '09:00', end: '17:00' },
    6: { enabled: false, start: '09:00', end: '17:00' },
  });

  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([
    { question: '', answer: '' },
  ]);

  const [showNumbers, setShowNumbers] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [phoneProvisioned, setPhoneProvisioned] = useState<string | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const simulateLoading = (nextStep: Step) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep(nextStep);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Text2Book</h1>
          <p className="text-gray-600 mt-2">Let us get you set up in just a few minutes</p>
          <div className="inline-flex items-center px-3 py-1 mt-2 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
            DEMO MODE
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-1 mx-1 ${
                      index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">{STEPS[currentStepIndex].title}</h2>
            <p className="text-gray-500">{STEPS[currentStepIndex].description}</p>
          </CardHeader>
          <CardContent>
            {currentStep === 'business' && (
              <div className="space-y-4">
                <Input
                  label="Business Name"
                  value={businessData.name}
                  onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                  placeholder="e.g. Jane's Hair Studio"
                />
                <Input
                  label="Category"
                  value={businessData.category}
                  onChange={(e) => setBusinessData({ ...businessData, category: e.target.value })}
                  placeholder="e.g. Hair Salon, Massage, Personal Training"
                />
                <Input
                  label="Phone"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                  placeholder="Your contact phone"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="City"
                    value={businessData.city}
                    onChange={(e) => setBusinessData({ ...businessData, city: e.target.value })}
                  />
                  <Input
                    label="State"
                    value={businessData.state}
                    onChange={(e) => setBusinessData({ ...businessData, state: e.target.value })}
                  />
                </div>
                <Button onClick={() => simulateLoading('calendar')} isLoading={isLoading} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {currentStep === 'calendar' && (
              <div className="space-y-4 text-center">
                {calendarConnected ? (
                  <>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-green-800 font-medium">Google Calendar Connected</p>
                    </div>
                    <Button onClick={() => setCurrentStep('services')} className="w-full">
                      Continue
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600">
                      Connect your Google Calendar so we can check your real availability
                      and add bookings automatically.
                    </p>
                    <Button onClick={() => setCalendarConnected(true)} className="w-full">
                      Connect Google Calendar (Demo)
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep('services')}
                      className="w-full"
                    >
                      Skip for now
                    </Button>
                  </>
                )}
              </div>
            )}

            {currentStep === 'services' && (
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <Input
                      label={`Service ${index + 1}`}
                      value={service.name}
                      onChange={(e) => {
                        const newServices = [...services];
                        newServices[index].name = e.target.value;
                        setServices(newServices);
                      }}
                      placeholder="e.g. Haircut, Massage, Training Session"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration
                        </label>
                        <select
                          value={service.duration}
                          onChange={(e) => {
                            const newServices = [...services];
                            newServices[index].duration = parseInt(e.target.value);
                            setServices(newServices);
                          }}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2"
                        >
                          {[15, 30, 45, 60, 90, 120].map((mins) => (
                            <option key={mins} value={mins}>
                              {formatDuration(mins)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Price (optional)"
                        type="number"
                        value={service.price}
                        onChange={(e) => {
                          const newServices = [...services];
                          newServices[index].price = e.target.value;
                          setServices(newServices);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setServices([...services, { name: '', duration: 60, price: '' }])}
                  className="w-full"
                >
                  + Add Another Service
                </Button>
                <Button onClick={() => simulateLoading('hours')} isLoading={isLoading} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {currentStep === 'hours' && (
              <div className="space-y-4">
                {DAYS.map((day, index) => (
                  <div key={day} className="flex items-center gap-4">
                    <label className="flex items-center gap-2 w-28">
                      <input
                        type="checkbox"
                        checked={hours[index].enabled}
                        onChange={(e) =>
                          setHours({
                            ...hours,
                            [index]: { ...hours[index], enabled: e.target.checked },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">{day}</span>
                    </label>
                    {hours[index].enabled && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={hours[index].start}
                          onChange={(e) =>
                            setHours({
                              ...hours,
                              [index]: { ...hours[index], start: e.target.value },
                            })
                          }
                          className="px-2 py-1 border rounded"
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={hours[index].end}
                          onChange={(e) =>
                            setHours({
                              ...hours,
                              [index]: { ...hours[index], end: e.target.value },
                            })
                          }
                          className="px-2 py-1 border rounded"
                        />
                      </div>
                    )}
                  </div>
                ))}
                <Button onClick={() => simulateLoading('faqs')} isLoading={isLoading} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {currentStep === 'faqs' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Add common questions your clients ask. This is optional but helps the AI
                  assistant answer questions better.
                </p>
                {faqs.map((faq, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <Input
                      label="Question"
                      value={faq.question}
                      onChange={(e) => {
                        const newFaqs = [...faqs];
                        newFaqs[index].question = e.target.value;
                        setFaqs(newFaqs);
                      }}
                      placeholder="e.g. Where are you located?"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Answer
                      </label>
                      <textarea
                        value={faq.answer}
                        onChange={(e) => {
                          const newFaqs = [...faqs];
                          newFaqs[index].answer = e.target.value;
                          setFaqs(newFaqs);
                        }}
                        placeholder="Your answer..."
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                  className="w-full"
                >
                  + Add Another FAQ
                </Button>
                <Button onClick={() => simulateLoading('phone')} isLoading={isLoading} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {currentStep === 'phone' && (
              <div className="space-y-4">
                {phoneProvisioned ? (
                  <div className="text-center">
                    <div className="p-4 bg-green-50 rounded-lg mb-4">
                      <p className="text-green-800 font-medium">Your Booking Number</p>
                      <p className="text-2xl font-bold text-green-900 mt-1">
                        {formatPhoneNumber(phoneProvisioned)}
                      </p>
                    </div>
                    <Button onClick={() => setCurrentStep('complete')} className="w-full">
                      Continue
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Search for an available phone number. Clients will text this number to
                      book appointments.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Area code (optional)"
                        className="w-32"
                      />
                      <Button onClick={() => setShowNumbers(true)}>
                        Search Numbers
                      </Button>
                    </div>
                    {showNumbers && (
                      <div className="space-y-2">
                        {DEMO_NUMBERS.map((num) => (
                          <label
                            key={num.phoneNumber}
                            className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                              selectedNumber === num.phoneNumber
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="phoneNumber"
                              value={num.phoneNumber}
                              checked={selectedNumber === num.phoneNumber}
                              onChange={(e) => setSelectedNumber(e.target.value)}
                              className="mr-3"
                            />
                            <div>
                              <p className="font-medium">
                                {formatPhoneNumber(num.phoneNumber)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {num.locality}, {num.region}
                              </p>
                            </div>
                          </label>
                        ))}
                        <Button
                          onClick={() => {
                            setIsLoading(true);
                            setTimeout(() => {
                              setIsLoading(false);
                              setPhoneProvisioned(selectedNumber);
                            }, 500);
                          }}
                          isLoading={isLoading}
                          className="w-full"
                          disabled={!selectedNumber}
                        >
                          Get This Number
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">You are all set!</h3>
                  <p className="text-gray-600 mt-2">
                    Your AI booking assistant is ready. Share your number with clients:
                  </p>
                  {phoneProvisioned && (
                    <p className="text-2xl font-bold text-blue-600 mt-4">
                      {formatPhoneNumber(phoneProvisioned)}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-left">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Sample text to share with clients:
                  </p>
                  <p className="text-sm text-blue-700">
                    Hey! You can now book appointments with me by texting{' '}
                    {phoneProvisioned ? formatPhoneNumber(phoneProvisioned) : 'my booking number'}.
                    Just send a message like &quot;I would like to book a haircut&quot; and my assistant will help you find a time!
                  </p>
                </div>
                <Link href="/dashboard">
                  <Button size="lg" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Demo Home
          </Link>
        </div>
      </div>
    </div>
  );
}
