'use client';

import { useTranslation } from 'react-i18next';

export default function SecurityPage() {
  const { t } = useTranslation();
  return <div>{t('admin.monitoring.title')}</div>;
}
