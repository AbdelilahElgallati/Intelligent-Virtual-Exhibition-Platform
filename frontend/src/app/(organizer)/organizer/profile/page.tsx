'use client';

import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Building, Mail, Shield } from 'lucide-react';

export default function OrganizerProfile() {
    const { user } = useAuth();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Organizer Profile</h1>
                <p className="text-gray-500">Manage your personal and organization information.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="md:col-span-2 p-6 space-y-6">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                        <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 text-3xl font-bold border-2 border-white shadow-sm">
                            {user?.full_name?.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{user?.full_name}</h2>
                            <p className="text-gray-500 text-sm">Organizer account</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <User className="w-3 h-3" /> Full Name
                            </label>
                            <div className="text-gray-900 font-medium">{user?.full_name}</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Mail className="w-3 h-3" /> Email Address
                            </label>
                            <div className="text-gray-900 font-medium">{user?.email}</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Building className="w-3 h-3" /> Organization
                            </label>
                            <div className="text-gray-900 font-medium">IVEP Organizer</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-3 h-3" /> Role
                            </label>
                            <div className="text-gray-900 font-medium capitalize">{user?.role}</div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end">
                        <Button className="bg-indigo-600 hover:bg-indigo-700">Update Profile</Button>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="p-6 bg-indigo-50 border-indigo-100">
                        <h3 className="font-bold text-indigo-900 mb-2">Account Security</h3>
                        <p className="text-indigo-800/80 text-sm mb-4">
                            Enhanced security is enabled for your organizer account.
                        </p>
                        <Button variant="outline" className="w-full bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                            Change Password
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
