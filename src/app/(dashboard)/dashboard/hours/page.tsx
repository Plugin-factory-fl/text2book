'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AvailabilityRule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const display = `${hour12}:${minute} ${period}`;
  return { value: time24, label: display };
});

export default function HoursPage() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/availability');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setRules(data);
        } else {
          // Default hours: Mon-Fri 9am-5pm
          setRules(
            [1, 2, 3, 4, 5].map((day) => ({
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch availability rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rules.filter((r) => r.isActive) }),
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data);
        alert('Hours saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save availability rules:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (dayOfWeek: number) => {
    const existing = rules.find((r) => r.dayOfWeek === dayOfWeek);
    if (existing) {
      setRules(
        rules.map((r) =>
          r.dayOfWeek === dayOfWeek ? { ...r, isActive: !r.isActive } : r
        )
      );
    } else {
      setRules([
        ...rules,
        {
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
    }
  };

  const updateTime = (
    dayOfWeek: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setRules(
      rules.map((r) =>
        r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r
      )
    );
  };

  const getDayRule = (dayOfWeek: number) => {
    return rules.find((r) => r.dayOfWeek === dayOfWeek);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading hours...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Hours</h1>
          <p className="text-gray-600 mt-1">
            Set the hours when clients can book appointments
          </p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>
          Save Hours
        </Button>
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="space-y-4">
            {DAYS.map((day, index) => {
              const rule = getDayRule(index);
              const isActive = rule?.isActive ?? false;

              return (
                <div
                  key={day}
                  className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="w-32">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleDay(index)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">{day}</span>
                    </label>
                  </div>

                  {isActive ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={rule?.startTime || '09:00'}
                        onChange={(e) =>
                          updateTime(index, 'startTime', e.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray-500">to</span>
                      <select
                        value={rule?.endTime || '17:00'}
                        onChange={(e) =>
                          updateTime(index, 'endTime', e.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-gray-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            Your calendar availability is also checked when booking. Even if
            these hours are set, clients will only be offered times that are
            free on your connected Google Calendar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
