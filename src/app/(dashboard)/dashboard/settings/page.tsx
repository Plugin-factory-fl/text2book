'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber, formatCurrency } from '@/lib/utils';

interface Business {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  timezone: string;
  cancellationPolicy: string | null;
  reminderHoursBefore: number;
  depositsEnabled: boolean;
  defaultDepositAmount: number | null;
  depositHoldMinutes: number;
  depositPolicyText: string | null;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  phoneNumber: {
    phoneNumber: string;
  } | null;
  calendarConnection: {
    provider: string;
    isActive: boolean;
  } | null;
}

interface TrustedClient {
  id: string;
  phone: string;
  name: string | null;
  notes: string | null;
  createdAt: string;
}

interface ConnectStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const calendarStatus = searchParams.get('calendar');
  const connectStatus = searchParams.get('connect');

  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [connectInfo, setConnectInfo] = useState<ConnectStatus | null>(null);
  const [trustedClients, setTrustedClients] = useState<TrustedClient[]>([]);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    cancellationPolicy: '',
    reminderHoursBefore: 24,
    depositsEnabled: false,
    defaultDepositAmount: '',
    depositHoldMinutes: 30,
    depositPolicyText: 'The deposit is non-refundable on no-show and will be applied toward your service.',
  });

  useEffect(() => {
    fetchBusiness();
    fetchConnectStatus();
    fetchTrustedClients();
  }, []);

  useEffect(() => {
    if (calendarStatus === 'connected') {
      setMessage('Google Calendar connected successfully!');
      fetchBusiness();
    } else if (calendarStatus === 'error') {
      setMessage('Failed to connect Google Calendar. Please try again.');
    }
    if (connectStatus === 'success') {
      setMessage('Payment account connected successfully!');
      fetchConnectStatus();
    } else if (connectStatus === 'refresh') {
      setMessage('Please complete your payment account setup.');
    }
  }, [calendarStatus, connectStatus]);

  const fetchBusiness = async () => {
    try {
      const response = await fetch('/api/business');
      if (response.ok) {
        const data = await response.json();
        if (data.business) {
          setBusiness(data.business);
          setFormData({
            name: data.business.name || '',
            category: data.business.category || '',
            description: data.business.description || '',
            phone: data.business.phone || '',
            email: data.business.email || '',
            address: data.business.address || '',
            city: data.business.city || '',
            state: data.business.state || '',
            zipCode: data.business.zipCode || '',
            cancellationPolicy: data.business.cancellationPolicy || '',
            reminderHoursBefore: data.business.reminderHoursBefore || 24,
            depositsEnabled: data.business.depositsEnabled || false,
            defaultDepositAmount: data.business.defaultDepositAmount 
              ? (data.business.defaultDepositAmount / 100).toString() 
              : '',
            depositHoldMinutes: data.business.depositHoldMinutes || 30,
            depositPolicyText: data.business.depositPolicyText || 
              'The deposit is non-refundable on no-show and will be applied toward your service.',
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch business:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConnectStatus = async () => {
    try {
      const response = await fetch('/api/connect/account');
      if (response.ok) {
        const data = await response.json();
        setConnectInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch connect status:', error);
    }
  };

  const fetchTrustedClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setTrustedClients(data.clients || []);
      }
    } catch (error) {
      console.error('Failed to fetch trusted clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const depositAmountCents = formData.defaultDepositAmount 
        ? Math.round(parseFloat(formData.defaultDepositAmount) * 100) 
        : null;

      const response = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          defaultDepositAmount: depositAmountCents,
        }),
      });

      if (response.ok) {
        setMessage('Settings saved successfully!');
        fetchBusiness();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to save settings');
      }
    } catch (error) {
      setMessage('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      const response = await fetch('/api/connect/account', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        setMessage('Failed to start payment setup');
      }
    } catch (error) {
      setMessage('Failed to start payment setup');
    }
  };

  const handleStripeDashboard = async () => {
    try {
      const response = await fetch('/api/connect/dashboard');
      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } catch (error) {
      setMessage('Failed to open Stripe dashboard');
    }
  };

  const handleAddTrustedClient = async () => {
    if (!newClientPhone.trim()) return;
    
    setIsAddingClient(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newClientPhone,
          name: newClientName || null,
        }),
      });

      if (response.ok) {
        setNewClientPhone('');
        setNewClientName('');
        fetchTrustedClients();
        setMessage('Trusted client added!');
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to add client');
      }
    } catch (error) {
      setMessage('Failed to add client');
    } finally {
      setIsAddingClient(false);
    }
  };

  const handleRemoveTrustedClient = async (clientId: string) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchTrustedClients();
      }
    } catch (error) {
      console.error('Failed to remove client:', error);
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
      console.error('Failed to initiate calendar connection:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your business information and preferences
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('success') || message.includes('connected')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {business?.phoneNumber && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <p className="text-sm text-blue-800">
              Your booking number:{' '}
              <span className="font-semibold">
                {formatPhoneNumber(business.phoneNumber.phoneNumber)}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
        </CardHeader>
        <CardContent>
          {business?.calendarConnection?.isActive ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-medium">Connected</p>
                <p className="text-sm text-gray-500">
                  Your calendar is synced for availability checking
                </p>
              </div>
              <Button variant="outline" onClick={handleConnectCalendar}>
                Reconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Not connected</p>
                <p className="text-sm text-gray-500">
                  Connect your Google Calendar to enable availability checking
                </p>
              </div>
              <Button onClick={handleConnectCalendar}>
                Connect Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Business Information</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <Input
                label="Category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="e.g. Hair Salon, Massage, Personal Training"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Tell clients about your business..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <Input
              label="Address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
              <Input
                label="State"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
              />
              <Input
                label="ZIP Code"
                value={formData.zipCode}
                onChange={(e) =>
                  setFormData({ ...formData, zipCode: e.target.value })
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder (hours before)
                </label>
                <select
                  value={formData.reminderHoursBefore}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminderHoursBefore: parseInt(e.target.value),
                    })
                  }
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {[1, 2, 4, 12, 24, 48].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} hour{hours !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Policy
              </label>
              <textarea
                value={formData.cancellationPolicy}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cancellationPolicy: e.target.value,
                  })
                }
                placeholder="Describe your cancellation policy..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="pt-4">
              <Button type="submit" isLoading={isSaving}>
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Connect Payouts</h2>
          <p className="text-sm text-gray-500">
            Receive deposit payments directly to your bank account
          </p>
        </CardHeader>
        <CardContent>
          {connectInfo?.onboardingComplete ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-medium">Connected</p>
                <p className="text-sm text-gray-500">
                  You can receive deposit payments
                </p>
              </div>
              <Button variant="outline" onClick={handleStripeDashboard}>
                View Stripe Dashboard
              </Button>
            </div>
          ) : connectInfo?.connected ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 font-medium">Setup Incomplete</p>
                <p className="text-sm text-gray-500">
                  Please complete your Stripe account setup to receive payments
                </p>
              </div>
              <Button onClick={handleConnectStripe}>Complete Setup</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Not connected</p>
                <p className="text-sm text-gray-500">
                  Connect your Stripe account to collect booking deposits
                </p>
              </div>
              <Button onClick={handleConnectStripe}>Connect Stripe</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Booking Deposits</h2>
          <p className="text-sm text-gray-500">
            Require a deposit to hold appointment slots
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="depositsEnabled"
                checked={formData.depositsEnabled}
                onChange={(e) =>
                  setFormData({ ...formData, depositsEnabled: e.target.checked })
                }
                disabled={!connectInfo?.onboardingComplete}
                className="w-4 h-4"
              />
              <label htmlFor="depositsEnabled" className="text-sm font-medium text-gray-700">
                Enable booking deposits
              </label>
            </div>

            {!connectInfo?.onboardingComplete && (
              <p className="text-sm text-yellow-600">
                Connect your Stripe account above to enable deposits
              </p>
            )}

            {formData.depositsEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Default Deposit Amount ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.defaultDepositAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultDepositAmount: e.target.value })
                    }
                    placeholder="e.g. 20"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hold Time (minutes)
                    </label>
                    <select
                      value={formData.depositHoldMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          depositHoldMinutes: parseInt(e.target.value),
                        })
                      }
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {[15, 30, 45, 60, 120].map((mins) => (
                        <option key={mins} value={mins}>
                          {mins} minutes
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deposit Policy Text
                  </label>
                  <textarea
                    value={formData.depositPolicyText}
                    onChange={(e) =>
                      setFormData({ ...formData, depositPolicyText: e.target.value })
                    }
                    placeholder="The deposit is non-refundable on no-show and will be applied toward your service."
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This policy is shared with clients when requesting deposits and the AI can answer FAQs about it.
                  </p>
                </div>

                <Button onClick={handleSubmit} isLoading={isSaving}>
                  Save Deposit Settings
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Trusted Clients</h2>
          <p className="text-sm text-gray-500">
            These clients can book without paying a deposit
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Phone number"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Name (optional)"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAddTrustedClient}
                isLoading={isAddingClient}
                disabled={!newClientPhone.trim()}
              >
                Add
              </Button>
            </div>

            {trustedClients.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {trustedClients.map((client) => (
                  <div key={client.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatPhoneNumber(client.phone)}
                      </p>
                      {client.name && (
                        <p className="text-sm text-gray-500">{client.name}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTrustedClient(client.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No trusted clients added yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
