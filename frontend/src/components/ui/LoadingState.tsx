'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export const LoadingState: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('common.messages.loading');
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-muted-foreground animate-pulse">{resolvedMessage}</p>
    </div>
  );
};
