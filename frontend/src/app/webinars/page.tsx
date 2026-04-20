"use client";

import { TranscriptUploader } from '@/components/webinars/TranscriptUploader';
import { Container } from '@/components/common/Container';
import { useTranslation } from 'react-i18next';

export default function WebinarsPage() {
  const { t } = useTranslation();
  const webinars = [
    {
      id: 'future-tech-expo',
      title: t('visitor.webinars.items.futureTechExpo.title'),
      date: t('visitor.webinars.items.futureTechExpo.date'),
      description: t('visitor.webinars.items.futureTechExpo.description'),
    },
    {
      id: 'healthcare-innovations',
      title: t('visitor.webinars.items.healthcareInnovations.title'),
      date: t('visitor.webinars.items.healthcareInnovations.date'),
      description: t('visitor.webinars.items.healthcareInnovations.description'),
    },
  ];

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <Container className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t('visitor.webinars.title')}</h1>
          <p className="text-gray-600">{t('visitor.webinars.subtitle')}</p>
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
          <h2 className="text-xl font-semibold text-gray-900">{t('visitor.webinars.transcriptViewer')}</h2>
          <p className="text-sm text-gray-600">{t('visitor.webinars.transcriptUpload')}</p>
          <TranscriptUploader />
        </div>
      </Container>
    </div>
  );
}
