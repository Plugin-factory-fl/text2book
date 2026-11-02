'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const PRESET_OPTIONS = [
  { id: 'square_clients', label: 'Square Appointments clients', kind: 'clients' },
  { id: 'square_appointments', label: 'Square Appointments upcoming', kind: 'appointments' },
  { id: 'vagaro_clients', label: 'Vagaro clients', kind: 'clients' },
  { id: 'vagaro_appointments', label: 'Vagaro appointments', kind: 'appointments' },
  { id: 'booksy_clients', label: 'Booksy clients', kind: 'clients' },
  { id: 'booksy_appointments', label: 'Booksy appointments', kind: 'appointments' },
  { id: 'fresha_clients', label: 'Fresha clients', kind: 'clients' },
  { id: 'fresha_appointments', label: 'Fresha appointments', kind: 'appointments' },
  { id: 'glossgenius_clients', label: 'GlossGenius clients', kind: 'clients' },
  { id: 'glossgenius_appointments', label: 'GlossGenius appointments', kind: 'appointments' },
  { id: 'acuity_clients', label: 'Acuity clients', kind: 'clients' },
  { id: 'acuity_appointments', label: 'Acuity appointments', kind: 'appointments' },
  { id: 'calendly_appointments', label: 'Calendly export', kind: 'appointments' },
  { id: 'generic_services', label: 'Services (name, duration, price)', kind: 'services' },
];

export function CsvImport() {
  const [presetId, setPresetId] = useState('square_clients');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<{
    kept: number;
    duplicates: number;
    preview: Array<{ data: Record<string, string>; duplicate: boolean; reason?: string }>;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const kind = PRESET_OPTIONS.find((p) => p.id === presetId)?.kind || 'clients';

  const run = async (apply: boolean) => {
    setIsWorking(true);
    setMessage('');
    try {
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, kind, presetId, apply }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Import failed');
        return;
      }
      if (apply) {
        setMessage(`Saved ${data.created} rows. Skipped ${data.skipped} duplicates.`);
        setPreview(null);
      } else {
        setPreview(data);
      }
    } catch {
      setMessage('Import failed');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Import from another booking app</h2>
        <p className="text-sm text-gray-500">
          Upload a CSV from Square, Vagaro, Booksy, Fresha, GlossGenius, Acuity, or Calendly. Preview and dedupe before save.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
        >
          {PRESET_OPTIONS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Paste CSV here"
          rows={6}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run(false)} isLoading={isWorking} disabled={!csv.trim()}>
            Preview
          </Button>
          <Button onClick={() => run(true)} isLoading={isWorking} disabled={!preview}>
            Save import
          </Button>
        </div>
        {message && <p className="text-sm text-gray-700">{message}</p>}
        {preview && (
          <div className="text-sm text-gray-700">
            <p>
              {preview.kept} new rows, {preview.duplicates} duplicates
            </p>
            <div className="mt-2 max-h-48 overflow-auto border border-gray-100 rounded">
              {preview.preview.slice(0, 12).map((row, i) => (
                <div key={i} className="px-2 py-1 border-b border-gray-50">
                  {Object.values(row.data).filter(Boolean).join(', ')}
                  {row.duplicate ? ` (${row.reason})` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
