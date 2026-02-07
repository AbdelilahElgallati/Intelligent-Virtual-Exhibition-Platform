import { useMutation } from '@tanstack/react-query';
import { translationApi } from '../services/translationApi';

export const useTranslation = () => {
    const mutation = useMutation({
        mutationFn: ({ text, targetLang, sourceLang }: { text: string; targetLang: string; sourceLang?: string }) =>
            translationApi.translate(text, targetLang, sourceLang),
    });

    return {
        translate: (text: string, targetLang: string, sourceLang?: string) =>
            mutation.mutateAsync({ text, targetLang, sourceLang }),
        isTranslating: mutation.isPending,
        error: mutation.error,
    };
};
