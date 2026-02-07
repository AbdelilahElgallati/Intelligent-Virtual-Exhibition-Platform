export interface KPIMetric {
    label: string;
    value: number;
    unit?: string;
    trend?: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

export interface AnalyticsData {
    kpis: KPIMetric[];
    main_chart: TimeSeriesPoint[];
    distribution: Record<string, number>;
    recent_activity: any[];
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface RecommendationItem {
    id: string;
    title: string;
    image: string;
    tags: string[];
    description?: string;
}

export interface TranslationResponse {
    original_text: string;
    translated_text: string;
    source_lang: string;
    target_lang: string;
}

export interface TranscriptLine {
    id: string;
    timestamp: string;
    text: string;
}
