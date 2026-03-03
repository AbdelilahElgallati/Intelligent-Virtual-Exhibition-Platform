'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function MarketplaceCancelPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-5">
                    <XCircle className="w-9 h-9 text-red-500" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
                <p className="text-gray-500 text-sm mb-6">
                    Your payment was cancelled. No charges were made. You can return to the stand and try again.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/events"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                        Browse Events
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
