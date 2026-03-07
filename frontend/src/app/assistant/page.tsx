"use client";

import { Container } from '@/components/common/Container';
import { ChatShell } from '@/components/assistant/ChatShell';

const suggestedPrompts = [
    'What events are trending today?',
    'Help me navigate this exhibition.',
    'Recommend stands based on my interests.',
];

export default function AssistantPage() {
    return (
        <Container className="py-10">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-indigo-600">AI-powered guidance</p>
                    <h1 className="text-3xl font-bold text-gray-900">Platform Assistant</h1>
                    <p className="text-gray-600 max-w-2xl">
                        Ask anything about the exhibition. The assistant can help you discover events, stands, and resources tailored to your interests.
                    </p>
                </div>

                <ChatShell
                    scope="platform"
                    title="Platform Assistant"
                    subtitle="Get instant answers with live updates from our knowledge base."
                    suggestedPrompts={suggestedPrompts}
                />
            </div>
        </Container>
    );
}
