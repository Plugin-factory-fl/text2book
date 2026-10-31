'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockAvailability } from '@/data/mock-data';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HoursPage() {
  const [hours, setHours] = useState(mockAvailability);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (day: number) => {
    setHours({
      ...hours,
      [day]: { ...hours[day as keyof typeof hours], enabled: !hours[day as keyof typeof hours].enabled },
    });
    setHasChanges(true);
  };

  const handleTimeChange = (day: number, field: 'start' | 'end', value: string) => {
    setHours({
      ...hours,
      [day]: { ...hours[day as keyof typeof hours], [field]: value },
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    alert('Demo mode: Hours would be saved');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Hours</h1>
          <p className="text-gray-600 mt-1">
            Set your weekly availability for bookings
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave}>Save Changes</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Weekly Schedule</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS.map((day, index) => {
              const dayHours = hours[index as keyof typeof hours];
              return (
                <div key={day} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <label className="flex items-center gap-3 w-32">
                    <input
                      type="checkbox"
                      checked={dayHours.enabled}
                      onChange={() => handleToggle(index)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`font-medium ${dayHours.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                      {day}
                    </span>
                  </label>
                  
                  {dayHours.enabled ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={dayHours.start}
                        onChange={(e) => handleTimeChange(index, 'start', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={dayHours.end}
                        onChange={(e) => handleTimeChange(index, 'end', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Closed</span>
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
            <strong>Tip:</strong> The AI assistant will only offer appointment slots during your business hours.
            Make sure to keep this updated if your schedule changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
