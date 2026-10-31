'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockFaqs } from '@/data/mock-data';

export default function FAQsPage() {
  const [faqs] = useState(mockFaqs);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Demo mode: FAQ would be saved');
    setShowForm(false);
    setFormData({ question: '', answer: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQs</h1>
          <p className="text-gray-600 mt-1">
            Add common questions to help the AI answer client inquiries
          </p>
        </div>
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
