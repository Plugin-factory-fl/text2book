'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockFaqs, mockBusiness } from '@/data/mock-data';
import { cn } from '@/lib/utils';

interface ExtractedData {
  businessName?: string;
  description?: string;
  address?: string;
  phone?: string;
  hours?: Record<string, { open: string; close: string }>;
  services?: Array<{ name: string; price?: number; duration?: number }>;
  policies?: {
    cancellation?: string;
    deposit?: string;
    late?: string;
  };
  faqs?: Array<{ question: string; answer: string }>;
}

interface FieldDiff {
  field: string;
  label: string;
  current: string;
  extracted: string;
  accepted: boolean;
}

const mockExtractedData: ExtractedData = {
  businessName: "Jane's Hair Studio",
  description: "Premier hair salon offering cuts, color, and styling services in a relaxed atmosphere",
  address: "123 Main Street, San Francisco, CA 94102",
  phone: "(555) 123-4567",
  hours: {
    Monday: { open: "9:00 AM", close: "6:00 PM" },
    Tuesday: { open: "9:00 AM", close: "6:00 PM" },
    Wednesday: { open: "9:00 AM", close: "6:00 PM" },
    Thursday: { open: "9:00 AM", close: "8:00 PM" },
    Friday: { open: "9:00 AM", close: "8:00 PM" },
    Saturday: { open: "10:00 AM", close: "4:00 PM" },
    Sunday: { open: "Closed", close: "Closed" },
  },
  services: [
    { name: "Women's Haircut", price: 65, duration: 60 },
    { name: "Men's Haircut", price: 35, duration: 30 },
    { name: "Color Treatment", price: 150, duration: 120 },
    { name: "Highlights", price: 200, duration: 150 },
    { name: "Blowout", price: 45, duration: 45 },
  ],
  policies: {
    cancellation: "Please provide at least 24 hours notice for cancellations. Late cancellations may be subject to a $25 fee.",
    deposit: "A 30% deposit is required for color services and new clients. Deposits are non-refundable for no-shows.",
    late: "Arriving more than 15 minutes late may result in a shortened appointment or rescheduling.",
  },
  faqs: [
    { question: "Do you accept walk-ins?", answer: "We prefer appointments but accept walk-ins when available." },
    { question: "What forms of payment do you accept?", answer: "We accept cash, credit cards, and digital payments." },
    { question: "Do you offer gift cards?", answer: "Yes! Gift cards are available in any amount." },
  ],
};

export default function BusinessInfoPage() {
  const [faqs, setFaqs] = useState(mockFaqs);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
  });

  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFillUrl, setAutoFillUrl] = useState('');
  const [autoFillFile, setAutoFillFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [fieldDiffs, setFieldDiffs] = useState<FieldDiff[]>([]);
  const [showReview, setShowReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFaq = {
      id: `faq-${Date.now()}`,
      question: formData.question,
      answer: formData.answer,
    };
    setFaqs([...faqs, newFaq]);
    setShowForm(false);
    setFormData({ question: '', answer: '' });
  };

  const handleAutoFillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoFillUrl && !autoFillFile) return;

    setIsExtracting(true);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const diffs: FieldDiff[] = [
      {
        field: 'businessName',
        label: 'Business Name',
        current: mockBusiness.name,
        extracted: mockExtractedData.businessName || '',
        accepted: true,
      },
      {
        field: 'description',
        label: 'Description',
        current: '',
        extracted: mockExtractedData.description || '',
        accepted: true,
      },
      {
        field: 'address',
        label: 'Address',
        current: `${mockBusiness.address}, ${mockBusiness.city}, ${mockBusiness.state}`,
        extracted: mockExtractedData.address || '',
        accepted: true,
      },
      {
        field: 'phone',
        label: 'Phone',
        current: mockBusiness.phone,
        extracted: mockExtractedData.phone || '',
        accepted: true,
      },
      {
        field: 'cancellationPolicy',
        label: 'Cancellation Policy',
        current: '',
        extracted: mockExtractedData.policies?.cancellation || '',
        accepted: true,
      },
      {
        field: 'depositPolicy',
        label: 'Deposit Policy',
        current: mockBusiness.depositPolicyText,
        extracted: mockExtractedData.policies?.deposit || '',
        accepted: true,
      },
    ];

    setExtractedData(mockExtractedData);
    setFieldDiffs(diffs);
    setIsExtracting(false);
    setShowReview(true);
  };

  const toggleFieldAcceptance = (field: string) => {
    setFieldDiffs((prev) =>
      prev.map((d) => (d.field === field ? { ...d, accepted: !d.accepted } : d))
    );
  };

  const acceptAll = () => {
    setFieldDiffs((prev) => prev.map((d) => ({ ...d, accepted: true })));
  };

  const applyChanges = () => {
    const acceptedCount = fieldDiffs.filter((d) => d.accepted && d.current !== d.extracted).length;
    const newFaqCount = extractedData?.faqs?.length || 0;

    alert(
      `Demo mode: Applied ${acceptedCount} field update(s)${
        newFaqCount > 0 ? ` and ${newFaqCount} new FAQ(s)` : ''
      }. In production, these changes would be saved to your business profile.`
    );

    if (extractedData?.faqs) {
      const newFaqs = extractedData.faqs.map((faq, i) => ({
        id: `faq-extracted-${i}`,
        ...faq,
      }));
      setFaqs((prev) => [...prev, ...newFaqs]);
    }

    setShowReview(false);
    setShowAutoFill(false);
    setAutoFillUrl('');
    setAutoFillFile(null);
    setExtractedData(null);
    setFieldDiffs([]);
  };

  const cancelReview = () => {
    setShowReview(false);
    setExtractedData(null);
    setFieldDiffs([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Info</h1>
          <p className="text-gray-600 mt-1">
            Manage your business details and add FAQs to help the AI answer client inquiries
          </p>
        </div>
      </div>

      {/* Auto-fill with AI Section */}
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
        <CardContent className="py-4">
          {!showAutoFill ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Auto-fill with AI</h3>
                  <p className="text-sm text-gray-600">
                    Upload a document or enter your website URL to automatically extract business info
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowAutoFill(true)}>
                Get Started
              </Button>
            </div>
          ) : showReview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Review Extracted Information</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={acceptAll}>
                    Accept All
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelReview}>
                    Cancel
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600">
                Review the extracted information below. Toggle fields to include or exclude them, then apply your changes.
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fieldDiffs.map((diff) => (
                  <div
                    key={diff.field}
                    className={cn(
                      'p-3 rounded-lg border transition-colors cursor-pointer',
                      diff.accepted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    )}
                    onClick={() => toggleFieldAcceptance(diff.field)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-700">{diff.label}</span>
                          {diff.current !== diff.extracted && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                              Changed
                            </span>
                          )}
                        </div>
                        {diff.current && diff.current !== diff.extracted && (
                          <p className="text-sm text-gray-500 line-through mt-1">{diff.current}</p>
                        )}
                        <p className="text-sm text-gray-900 mt-1">{diff.extracted}</p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                        diff.accepted ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      )}>
                        {diff.accepted && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {extractedData?.services && extractedData.services.length > 0 && (
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Services Found ({extractedData.services.length})
                    </h4>
                    <div className="space-y-1">
                      {extractedData.services.map((svc, i) => (
                        <div key={i} className="text-sm text-gray-600">
                          {svc.name} {svc.price && `- $${svc.price}`} {svc.duration && `(${svc.duration} min)`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractedData?.faqs && extractedData.faqs.length > 0 && (
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      FAQs to Add ({extractedData.faqs.length})
                    </h4>
                    <div className="space-y-2">
                      {extractedData.faqs.map((faq, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium text-gray-700">{faq.question}</p>
                          <p className="text-gray-600">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={cancelReview}>
                  Cancel
                </Button>
                <Button onClick={applyChanges}>
                  Apply {fieldDiffs.filter((d) => d.accepted).length} Changes
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAutoFillSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Import Business Information</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAutoFill(false);
                    setAutoFillUrl('');
                    setAutoFillFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website URL
                  </label>
                  <Input
                    type="url"
                    value={autoFillUrl}
                    onChange={(e) => setAutoFillUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll scan your homepage and related pages (about, services, contact, FAQ)
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-blue-50 text-gray-500">or</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Document
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => setAutoFillFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors text-center"
                  >
                    {autoFillFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-700">{autoFillFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAutoFillFile(null);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600">Click to upload PDF, DOCX, TXT, or image</p>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAutoFill(false);
                    setAutoFillUrl('');
                    setAutoFillFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={(!autoFillUrl && !autoFillFile) || isExtracting}
                >
                  {isExtracting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Extracting...
                    </span>
                  ) : (
                    'Extract Information'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Business Details</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Business Name</label>
              <p className="mt-1 text-gray-900">{mockBusiness.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <p className="mt-1 text-gray-900">{mockBusiness.category}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="mt-1 text-gray-900">{mockBusiness.phone}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <p className="mt-1 text-gray-900">
                {mockBusiness.address}, {mockBusiness.city}, {mockBusiness.state}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => alert('Demo mode: Would open edit form')}
            >
              Edit Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Add FAQ</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">New FAQ</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Question"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                placeholder="e.g. Where are you located?"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Answer
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  placeholder="Your answer to this question..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit">Add FAQ</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No FAQs yet. Add common questions to help the AI assistant
              answer client inquiries more accurately.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {faq.question}
                    </h3>
                    <p className="text-sm text-gray-600 mt-2">
                      {faq.answer}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alert('Demo mode: Would open edit form')}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => alert('Demo mode: Would delete FAQ')}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> When clients ask questions via text, 
            the AI assistant will check your FAQs first and use these answers 
            to respond accurately. The more FAQs you add, the better the AI 
            can help your clients.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
