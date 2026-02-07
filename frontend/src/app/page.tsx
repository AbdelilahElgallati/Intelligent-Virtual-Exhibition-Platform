import Link from 'next/link';
import { Zap, Users, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
            <div className="max-w-4xl w-full text-center">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                        <Zap size={36} fill="white" />
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tighter">IVEP<span className="text-indigo-600">.</span></h1>
                </div>

                <h2 className="text-3xl font-black text-gray-900 mb-4">Intelligent Virtual Exhibition Platform</h2>
                <p className="text-gray-500 font-medium text-lg mb-12">Choose your experience to test the Person B implementation.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Link href="/visitor" className="group">
                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all h-full flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 transition-transform">
                                <Users size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-4">Visitor Experience</h3>
                            <p className="text-gray-500 font-medium mb-8">Browse the hall, visit stands, chat with AI assistant, and schedule meetings.</p>
                            <span className="mt-auto px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm">Enter Hall</span>
                        </div>
                    </Link>

                    <Link href="/enterprise" className="group">
                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all h-full flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform">
                                <ShieldCheck size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-4">Enterprise Hub</h3>
                            <p className="text-gray-500 font-medium mb-8">Manage your stand, analyze visitor performance, and track leads in the CRM.</p>
                            <span className="mt-auto px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm">Dashboard</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
