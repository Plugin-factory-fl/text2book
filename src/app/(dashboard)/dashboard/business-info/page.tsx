'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BusinessAutofill } from '@/components/dashboard/business-autofill';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface BusinessDetails {
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  cancellationPolicy: string | null;
  depositPolicyText: string | null;
}

export default function BusinessInfoPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPageData();
  }, []);

  const fetchFAQs = async () => {
    try {
      const response = await fetch('/api/faqs');
      if (response.ok) {
        const data = await response.json();
        setFaqs(data);
      }
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    }
  };

  const fetchPageData = async () => {
    try {
      const [faqRes, businessRes] = await Promise.all([
        fetch('/api/faqs'),
        fetch('/api/business'),
      ]);
      if (faqRes.ok) {
        setFaqs(await faqRes.json());
      }
      if (businessRes.ok) {
        const data = await businessRes.json();
        setBusiness(data.business);
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/faqs/${editingId}` : '/api/faqs',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        fetchFAQs();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save FAQ:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (faq: FAQ) => {
    setFormData({
      question: faq.question,
      answer: faq.answer,
    });
    setEditingId(faq.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const response = await fetch(`/api/faqs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFAQs();
      }
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
    }
  };

  const resetForm = () => {
    setFormData({ question: '', answer: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Info</h1>
          <p className="text-gray-600 mt-1">
            Add common questions your AI assistant can answer
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Add Entry</Button>
        )}
      </div>

      {business && (
        <BusinessAutofill
          current={{
            businessName: business.name,
            description: business.description,
            address: business.address,
            city: business.city,
            state: business.state,
            zipCode: business.zipCode,
            phone: business.phone,
            cancellationPolicy: business.cancellationPolicy,
            depositPolicy: business.depositPolicyText,
          }}
          onApplied={fetchPageData}
        />
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {editingId ? 'Edit FAQ' : 'New FAQ'}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Question"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                placeholder="e.g. What are your hours? Where are you located?"
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
                  placeholder="Provide a helpful answer..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" isLoading={isSaving}>
                  {editingId ? 'Update FAQ' : 'Add FAQ'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading FAQs...</p>
        </div>
      ) : faqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No FAQs yet. Add common questions so your AI assistant can answer
              them automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      Q: {faq.question}
                    </h3>
                    <p className="text-gray-600 mt-2">A: {faq.answer}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(faq)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(faq.id)}
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

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-4">
          <h3 className="font-medium text-amber-800 mb-2">Suggested FAQs</h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>What are your hours?</li>
            <li>Where are you located?</li>
            <li>How much do you charge?</li>
            <li>What is your cancellation policy?</li>
            <li>How can I reschedule my appointment?</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
