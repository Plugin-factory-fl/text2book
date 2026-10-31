'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber } from '@/lib/utils';
import { mockBusiness } from '@/data/mock-data';

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    name: mockBusiness.name,
    category: mockBusiness.category,
    phone: mockBusiness.phone,
    address: mockBusiness.address,
    city: mockBusiness.city,
    state: mockBusiness.state,
    reminderHoursBefore: mockBusiness.reminderHoursBefore,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    alert('Demo mode: Settings would be saved');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your business information and preferences
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave}>Save Changes</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Business Information</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              label="Business Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <Input
              label="Category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              placeholder="e.g. Hair Salon, Massage, Personal Training"
            />

            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />

            <Input
              label="Address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
              <Input
                label="State"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Booking Phone Number</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {formatPhoneNumber(mockBusiness.phoneNumber.phoneNumber)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Share this number with clients for text booking
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">SMS Usage This Month</p>
              <p className="text-lg font-semibold text-gray-900">
                {mockBusiness.phoneNumber.monthlySmsSent} / {mockBusiness.phoneNumber.monthlySmsCap}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Connected</p>
              <p className="text-sm text-gray-500">
                Your calendar is synced for availability and booking events
              </p>
            </div>
            <Button variant="outline" onClick={() => alert('Demo mode: Would reconnect calendar')}>
              Reconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Reminder Settings</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send reminder before appointment
              </label>
              <select
                value={formData.reminderHoursBefore}
                onChange={(e) => handleChange('reminderHoursBefore', parseInt(e.target.value))}
                className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={12}>12 hours before</option>
                <option value={24}>24 hours before</option>
                <option value={48}>48 hours before</option>
              </select>
            </div>
            <p className="text-sm text-gray-500">
              Clients will receive an SMS reminder at this time before their appointment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
