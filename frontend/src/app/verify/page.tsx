'use client';

import React, { Suspense } from 'react';
import { VisitorView } from '../../views/visitor/VisitorView';
import { EnterpriseView } from '../../views/enterprise/EnterpriseView';
import { MeetingBookingList } from '../../components/meetings/MeetingBookingList';
import { NetworkingSidebar } from '../../components/meetings/NetworkingSidebar';
import { ResourceCatalog } from '../../components/resources/ResourceCatalog';
import { LeadCRM } from '../../components/leads/LeadCRM';

export default function VerifyPage() {
    const [view, setView] = React.useState<'visitor' | 'enterprise' | 'components'>('components');

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-12 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900">Person B <span className="text-indigo-600">Verification</span></h1>
                        <p className="text-gray-500 mt-2 font-medium">Test rendering of all implemented modules.</p>
                    </div>

                    <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                        <button
                            onClick={() => setView('components')}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === 'components' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            All Components
                        </button>
                        <button
                            onClick={() => setView('visitor')}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === 'visitor' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Visitor View
                        </button>
                        <button
                            onClick={() => setView('enterprise')}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === 'enterprise' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Enterprise View
                        </button>
                    </div>
                </header>

                <Suspense fallback={<div className="p-20 text-center font-bold text-gray-400">Loading modules...</div>}>
                    {view === 'components' && (
                        <div className="space-y-12">
                            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-black mb-8 border-l-4 border-indigo-600 pl-4">Meetings & Networking</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2">
                                        <MeetingBookingList />
                                    </div>
                                    <div>
                                        <NetworkingSidebar />
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-black mb-8 border-l-4 border-green-600 pl-4">Resources & Media</h2>
                                <ResourceCatalog standId="test-stand" />
                            </section>

                            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-black mb-8 border-l-4 border-amber-600 pl-4">Lead CRM</h2>
                                <LeadCRM standId="test-stand" />
                            </section>
                        </div>
                    )}

                    {view === 'visitor' && <VisitorView />}
                    {view === 'enterprise' && <EnterpriseView />}
                </Suspense>
            </div>
        </div>
    );
}
