'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [businessData, setBusinessData] = useState({
    name: '',
    category: '',
    phone: '',
    address: '',
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

  const [availableNumbers, setAvailableNumbers] = useState<Array<{
    phoneNumber: string;
    locality: string;
    region: string;
  }>>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [phoneProvisioned, setPhoneProvisioned] = useState<string | null>(null);

  useEffect(() => {
    checkExistingBusiness();
  }, []);

  const checkExistingBusiness = async () => {
    try {
      const response = await fetch('/api/business');
      if (response.ok) {
        const data = await response.json();
        if (data.business?.onboardingComplete) {
          router.push('/dashboard');
        } else if (data.business) {
          setBusinessData({
            name: data.business.name || '',
            category: data.business.category || '',
            phone: data.business.phone || '',
            address: data.business.address || '',
            city: data.business.city || '',
            state: data.business.state || '',
          });
          if (data.business.calendarConnection?.isActive) {
            setCalendarConnected(true);
          }
          if (data.business.phoneNumber) {
            setPhoneProvisioned(data.business.phoneNumber.phoneNumber);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check business:', error);
    }
  };

  const handleBusinessSubmit = async () => {
    if (!businessData.name) {
      setError('Business name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/business');
      const existing = await response.json();

      const method = existing.business ? 'PATCH' : 'POST';
      const saveResponse = await fetch('/api/business', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessData),
      });

      if (saveResponse.ok) {
        setCurrentStep('calendar');
      } else {
        const data = await saveResponse.json();
        setError(data.error || 'Failed to save business info');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const response = await fetch('/api/calendar/connect');
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      }
    } catch (error) {
      setError('Failed to initiate calendar connection');
    }
  };

  const handleServicesSubmit = async () => {
    const validServices = services.filter((s) => s.name.trim());
    if (validServices.length === 0) {
      setError('Please add at least one service');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      for (const service of validServices) {
        await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: service.name,
            duration: service.duration,
            price: service.price ? parseFloat(service.price) : undefined,
          }),
        });
      }
      setCurrentStep('hours');
    } catch (err) {
      setError('Failed to save services');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHoursSubmit = async () => {
    const rules = Object.entries(hours)
      .filter(([_, data]) => data.enabled)
      .map(([day, data]) => ({
        dayOfWeek: parseInt(day),
        startTime: data.start,
        endTime: data.end,
        isActive: true,
      }));

    if (rules.length === 0) {
      setError('Please set at least one day of availability');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      setCurrentStep('faqs');
    } catch (err) {
      setError('Failed to save hours');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFAQsSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
      for (const faq of validFaqs) {
        await fetch('/api/faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(faq),
        });
      }
      setCurrentStep('phone');
    } catch (err) {
      setError('Failed to save FAQs');
    } finally {
      setIsLoading(false);
    }
  };

  const searchNumbers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (areaCode) params.set('areaCode', areaCode);

      const response = await fetch(`/api/phone/available?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableNumbers(data.numbers);
      } else {
        setError('Failed to search phone numbers');
      }
    } catch (err) {
      setError('Failed to search phone numbers');
    } finally {
      setIsLoading(false);
    }
  };

  const provisionNumber = async () => {
    if (!selectedNumber) {
      setError('Please select a phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/phone/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedNumber }),
      });

      if (response.ok) {
        const data = await response.json();
        setPhoneProvisioned(data.phoneNumber);
        setCurrentStep('complete');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to provision phone number');
      }
    } catch (err) {
      setError('Failed to provision phone number');
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to complete onboarding');
      }
    } catch (err) {
      setError('Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Text2Book</h1>
          <p className="text-gray-600 mt-2">Let us get you set up in just a few minutes</p>
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

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

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
                  required
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
                <Button onClick={handleBusinessSubmit} isLoading={isLoading} className="w-full">
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
                    <Button onClick={handleConnectCalendar} className="w-full">
                      Connect Google Calendar
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
                <Button onClick={handleServicesSubmit} isLoading={isLoading} className="w-full">
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
                <Button onClick={handleHoursSubmit} isLoading={isLoading} className="w-full">
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
                <Button onClick={handleFAQsSubmit} isLoading={isLoading} className="w-full">
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
                        value={areaCode}
                        onChange={(e) => setAreaCode(e.target.value)}
                        className="w-32"
                      />
                      <Button onClick={searchNumbers} isLoading={isLoading}>
                        Search Numbers
                      </Button>
                    </div>
                    {availableNumbers.length > 0 && (
                      <div className="space-y-2">
                        {availableNumbers.map((num) => (
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
                          onClick={provisionNumber}
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
                    Just send a message like "I would like to book a haircut" and my assistant will help you find a time!
                  </p>
                </div>
                <Button onClick={completeOnboarding} isLoading={isLoading} size="lg" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
