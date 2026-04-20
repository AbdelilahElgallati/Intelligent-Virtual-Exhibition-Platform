'use client';

import { useTranslation } from 'react-i18next';

export default function DiagPage() {
    const { t } = useTranslation();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'NOT_SET';
    return (
        <pre style={{ padding: 40, fontSize: 18 }}>
            {t('common.diag.apiUrl', { value: apiUrl })}
        </pre>
    );
}
