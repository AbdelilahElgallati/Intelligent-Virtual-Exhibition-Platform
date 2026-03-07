"use client";

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptResponse {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptSegment[];
}

export const TranscriptUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<TranscriptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiClient.post<TranscriptResponse>(ENDPOINTS.TRANSCRIPTS.UPLOAD, form);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to transcribe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
        <div>
          <label className="text-sm font-medium text-gray-700">Upload audio</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 w-full text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!file || loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transcribe'}
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>

      {result && (
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm space-y-3">
          <div className="text-sm text-gray-500">Language: {result.language} · Duration: {result.duration.toFixed(1)}s</div>
          <div className="text-gray-900 whitespace-pre-wrap text-sm">{result.text}</div>
          {result.segments?.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="text-xs font-semibold text-gray-600">Segments</div>
              <ul className="space-y-1">
                {result.segments.map((seg, idx) => (
                  <li key={idx} className="text-xs text-gray-700">
                    [{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s] {seg.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
