"use client";

import { Container } from '@/components/common/Container';
import { ChatShell } from '@/components/assistant/ChatShell';
import { useTranslation } from 'react-i18next';

export default function AssistantPage() {
    const { t } = useTranslation();
    const suggestedPrompts = [
        t('visitor.assistantPage.suggestedPrompts.trendingEvents'),
        t('visitor.assistantPage.suggestedPrompts.navigateExhibition'),
        t('visitor.assistantPage.suggestedPrompts.recommendStands'),
    ];

    return (
        <Container className="py-10">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-indigo-600">{t('visitor.assistantPage.badge')}</p>
                    <h1 className="text-3xl font-bold text-gray-900">{t('visitor.assistantPage.title')}</h1>
                    <p className="text-gray-600 max-w-2xl">
                        {t('visitor.assistantPage.subtitle')}
                    </p>
                </div>

                <ChatShell
                    scope="platform"
                    title={t('visitor.assistantPage.chat.title')}
                    subtitle={t('visitor.assistantPage.chat.subtitle')}
                    suggestedPrompts={suggestedPrompts}
                />
            </div>
        </Container>
    );
}
