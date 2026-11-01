'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ExtractedBusinessInfo } from '@/types/business-import';

interface CurrentBusiness {
  businessName: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  cancellationPolicy: string | null;
  depositPolicy: string | null;
}

interface FieldRow {
  key: keyof CurrentBusiness | 'latePolicy';
  label: string;
  current: string;
  extracted: string;
}

interface BusinessAutofillProps {
  current: CurrentBusiness;
  onApplied: () => void;
}

function formatAddress(current: CurrentBusiness): string {
  return [current.address, current.city, current.state, current.zipCode].filter(Boolean).join(', ');
}

function buildRows(current: CurrentBusiness, extracted: ExtractedBusinessInfo): FieldRow[] {
  return [
    {
      key: 'businessName',
      label: 'Business Name',
      current: current.businessName || '',
      extracted: extracted.businessName || '',
    },
    {
      key: 'description',
      label: 'Description',
      current: current.description || '',
      extracted: extracted.description || '',
    },
    {
      key: 'phone',
      label: 'Phone',
      current: current.phone || '',
      extracted: extracted.phone || '',
    },
    {
      key: 'address',
      label: 'Address',
      current: formatAddress(current),
      extracted: [extracted.address, extracted.city, extracted.state, extracted.zipCode].filter(Boolean).join(', '),
    },
    {
      key: 'cancellationPolicy',
      label: 'Cancellation Policy',
      current: current.cancellationPolicy || '',
      extracted: extracted.policies?.cancellation || '',
    },
    {
      key: 'depositPolicy',
      label: 'Deposit Policy',
      current: current.depositPolicy || '',
      extracted: extracted.policies?.deposit || '',
    },
    {
      key: 'latePolicy',
      label: 'Late Policy',
      current: '',
      extracted: extracted.policies?.late || '',
    },
  ].filter((row) => row.extracted);
}

export function BusinessAutofill({ current, onApplied }: BusinessAutofillProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedBusinessInfo | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = extracted ? buildRows(current, extracted) : [];

  const reset = () => {
    setOpen(false);
    setUrl('');
    setFile(null);
    setError('');
    setExtracted(null);
    setAccepted({});
    setEdits({});
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url && !file) return;
    setIsExtracting(true);
    setError('');

    try {
      const form = new FormData();
      if (url) form.set('url', url);
      if (file) form.set('file', file);

      const response = await fetch('/api/business/import', {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract information');
      }

      setExtracted(data.extracted);
      const nextAccepted: Record<string, boolean> = {
        hours: Boolean(data.extracted.hours?.length),
        services: Boolean(data.extracted.services?.length),
        faqs: Boolean(data.extracted.faqs?.length),
      };
      for (const row of buildRows(current, data.extracted)) {
        nextAccepted[row.key] = true;
      }
      setAccepted(nextAccepted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract information');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApply = async () => {
    if (!extracted) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/business/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted,
          accepted: {
            ...accepted,
            city: accepted.address,
            state: accepted.address,
            zipCode: accepted.address,
            edited: {
              businessName: edits.businessName,
              description: edits.description,
              address: edits.address,
              phone: edits.phone,
              cancellationPolicy: edits.cancellationPolicy,
              depositPolicy: edits.depositPolicy,
            },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply changes');
      }
      onApplied();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
      <CardContent className="py-4">
        {!open && !extracted ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Auto-fill with AI</h3>
                <p className="text-sm text-gray-600">
                  Upload a document or paste a website URL. Nothing is overwritten until you review and accept it.
                </p>
              </div>
            </div>
            <Button onClick={() => setOpen(true)}>Get Started</Button>
          </div>
        ) : extracted ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Review extracted information</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setAccepted((prev) => {
                      const next = { ...prev };
                      for (const row of rows) next[row.key] = true;
                      next.hours = true;
                      next.services = true;
                      next.faqs = true;
                      return next;
                    })
                  }
                >
                  Accept All
                </Button>
                <Button size="sm" variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Compare each field with your current values. Accept, skip, or edit before saving.
            </p>

            <div className="space-y-3 max-h-[32rem] overflow-y-auto">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    'p-3 rounded-lg border',
                    accepted[row.key] ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-700">{row.label}</span>
                        {row.current && row.current !== row.extracted && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                            Changed
                          </span>
                        )}
                      </div>
                      {row.current && row.current !== (edits[row.key] ?? row.extracted) && (
                        <p className="text-sm text-gray-500 line-through mt-1">{row.current}</p>
                      )}
                      <textarea
                        value={edits[row.key] ?? row.extracted}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [row.key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        rows={row.extracted.length > 80 ? 3 : 1}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccepted((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                        accepted[row.key] ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      )}
                      aria-label={accepted[row.key] ? `Skip ${row.label}` : `Accept ${row.label}`}
                    >
                      {accepted[row.key] && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {extracted.hours && extracted.hours.length > 0 && (
                <GroupToggle
                  title={`Hours found (${extracted.hours.length})`}
                  accepted={!!accepted.hours}
                  onToggle={() => setAccepted((prev) => ({ ...prev, hours: !prev.hours }))}
                >
                  {extracted.hours.map((hour) => (
                    <p key={hour.dayOfWeek} className="text-sm text-gray-600">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][hour.dayOfWeek]}:{' '}
                      {hour.isActive ? `${hour.startTime} to ${hour.endTime}` : 'Closed'}
                    </p>
                  ))}
                </GroupToggle>
              )}

              {extracted.services && extracted.services.length > 0 && (
                <GroupToggle
                  title={`Services found (${extracted.services.length})`}
                  accepted={!!accepted.services}
                  onToggle={() => setAccepted((prev) => ({ ...prev, services: !prev.services }))}
                >
                  {extracted.services.map((service) => (
                    <p key={service.name} className="text-sm text-gray-600">
                      {service.name}
                      {service.price != null ? ` · $${service.price}` : ''}
                      {service.duration != null ? ` · ${service.duration} min` : ''}
                    </p>
                  ))}
                </GroupToggle>
              )}

              {extracted.faqs && extracted.faqs.length > 0 && (
                <GroupToggle
                  title={`FAQs to add (${extracted.faqs.length})`}
                  accepted={!!accepted.faqs}
                  onToggle={() => setAccepted((prev) => ({ ...prev, faqs: !prev.faqs }))}
                >
                  {extracted.faqs.map((faq) => (
                    <div key={faq.question} className="text-sm mb-2">
                      <p className="font-medium text-gray-700">{faq.question}</p>
                      <p className="text-gray-600">{faq.answer}</p>
                    </div>
                  ))}
                </GroupToggle>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleApply} isLoading={isSaving}>
                Apply selected changes
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleExtract} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Import business information</h3>
              <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourbusiness.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                We scan the homepage plus same-domain pages like about, services, contact, and FAQ.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload document</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors text-center"
              >
                {file ? (
                  <span className="text-sm text-gray-700">{file.name}</span>
                ) : (
                  <span className="text-sm text-gray-600">Click to upload PDF, DOCX, or TXT</span>
                )}
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button type="submit" disabled={(!url && !file) || isExtracting} isLoading={isExtracting}>
                Extract Information
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function GroupToggle({
  title,
  accepted,
  onToggle,
  children,
}: {
  title: string;
  accepted: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={cn('p-3 rounded-lg border', accepted ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200')}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-medium text-sm text-gray-700">{title}</h4>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
            accepted ? 'bg-green-500 border-green-500' : 'border-gray-300'
          )}
          aria-label={accepted ? `Skip ${title}` : `Accept ${title}`}
        >
          {accepted && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>
      {children}
    </div>
  );
}
