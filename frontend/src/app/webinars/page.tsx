"use client";

import { TranscriptUploader } from '@/components/webinars/TranscriptUploader';
import { Container } from '@/components/common/Container';

const webinars = [
  {
    id: 'future-tech-expo',
    title: 'Future Tech Expo Keynote',
    date: 'Feb 17, 2026',
    description: 'Highlights from AI, cloud, and XR demos across virtual stands.',
  },
  {
    id: 'healthcare-innovations',
    title: 'Healthcare Innovations Summit',
    date: 'Feb 17, 2026',
    description: 'Digital health and biotech sessions with Q&A.',
  },
];

export default function WebinarsPage() {
  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <Container className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Webinars</h1>
          <p className="text-gray-600">Watch sessions and upload recordings to get instant transcripts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {webinars.map((w) => (
            <div key={w.id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="text-xs font-semibold text-indigo-600 uppercase">{w.date}</div>
              <h3 className="text-lg font-semibold text-gray-900 mt-1">{w.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{w.description}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Transcript Viewer</h2>
          <p className="text-sm text-gray-600">Upload an audio recording to generate a transcript.</p>
          <TranscriptUploader />
        </div>
      </Container>
    </div>
  );
}
