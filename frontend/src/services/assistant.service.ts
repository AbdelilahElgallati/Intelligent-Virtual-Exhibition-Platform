import { API_BASE_URL } from '@/lib/config';
import { getAccessToken } from '@/lib/auth';

export type AssistantRole = 'user' | 'assistant' | 'system';

export interface AssistantMessage {
	id: string;
	role: AssistantRole;
	content: string;
	createdAt: string;
}

export interface SourceDocument {
	title?: string;
	url?: string;
	snippet?: string;
	[key: string]: unknown;
}

type StreamParams = {
	scope: string;
	query: string;
	token?: string | null;
	signal?: AbortSignal;
	onTokenChunk: (text: string) => void;
};

type QueryWithSourcesParams = {
	scope: string;
	query: string;
	top_k?: number;
	model?: string;
	token?: string | null;
};

const assistantBase = `${API_BASE_URL}/api/v1/assistant`;

function buildHeaders(token?: string | null): HeadersInit {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	const activeToken = token ?? getAccessToken();
	if (activeToken) {
		headers['Authorization'] = `Bearer ${activeToken}`;
	}

	return headers;
}

export async function streamAssistantQuery({ scope, query, token, signal, onTokenChunk }: StreamParams) {
	const response = await fetch(`${assistantBase}/${scope}/query`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({ query }),
		signal,
	});

	if (!response.ok || !response.body) {
		const status = response.status;
		const message = status === 401
			? 'Unauthorized'
			: status === 501 || status === 503
				? 'AI features not enabled on this server'
				: 'Unable to connect to assistant';
		throw new Error(message);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		const lines = buffer.split(/\r?\n/);
		buffer = lines.pop() ?? '';

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line.startsWith('data:')) continue;
			const data = line.slice(5).trim();
			if (!data) continue;
			if (data === '[DONE]') {
				return;
			}

			try {
				const parsed = JSON.parse(data);
				const text = parsed.text ?? parsed.delta ?? parsed.content ?? '';
				if (typeof text === 'string' && text.length > 0) {
					onTokenChunk(text);
				}
			} catch (error) {
				console.error('Failed to parse assistant chunk', error);
			}
		}
	}
}

export async function queryWithSources<T = { answer: string; sources?: SourceDocument[] }>(params: QueryWithSourcesParams): Promise<T> {
	const { scope, query, top_k = 3, model, token } = params;
	const response = await fetch(`${assistantBase}/${scope}/query-with-sources`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({ query, top_k, model }),
	});

	if (!response.ok) {
		const status = response.status;
		const message = status === 401
			? 'Unauthorized'
			: status === 501 || status === 503
				? 'AI features not enabled on this server'
				: 'Assistant request failed';
		throw new Error(message);
	}

	return response.json();
}
