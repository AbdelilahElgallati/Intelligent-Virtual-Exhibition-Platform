"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { http } from '@/lib/http';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Palette, Package, FileText, Cpu, CheckCircle2,
    Plus, Trash2, Upload, Zap, AlertCircle
} from 'lucide-react';

type Tab = 'branding' | 'products' | 'resources' | 'ai';

export default function StandConfigPage() {
    const params = useParams();
    const eventId = params?.eventId as string;

    const [stand, setStand] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('branding');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Branding state
    const [branding, setBranding] = useState({ name: '', description: '', logo_url: '', theme_color: '#4f46e5', stand_background_url: '', presenter_name: '' });

    // Products state
    const [myProducts, setMyProducts] = useState<any[]>([]);
    const [linkedProducts, setLinkedProducts] = useState<string[]>([]);

    // Resources state
    const [resources, setResources] = useState<any[]>([]);
    const [newResource, setNewResource] = useState({ title: '', resource_type: 'pdf', url: '', file: null as File | null });

    // RAG state
    const [ragStatus, setRagStatus] = useState<any>(null);
    const [ragLoading, setRagLoading] = useState(false);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [standData, ragData, productsData] = await Promise.allSettled([
                http.get<any>(`/enterprise/events/${eventId}/stand`),
                http.get<any>(`/enterprise/events/${eventId}/stand/assistant-status`),
                http.get<any>('/enterprise/products'),
            ]);
            if (standData.status === 'fulfilled') {
                const s = standData.value;
                setStand(s);
                setBranding({
                    name: s.name || '',
                    description: s.description || '',
                    logo_url: s.logo_url || '',
                    theme_color: s.theme_color || '#4f46e5',
                    stand_background_url: s.stand_background_url || '',
                    presenter_name: s.presenter_name || '',
                });
                setLinkedProducts(s.products || []);
            }
            if (ragData.status === 'fulfilled') setRagStatus(ragData.value);
            if (productsData.status === 'fulfilled') setMyProducts(productsData.value?.products || []);
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    const fetchResources = async () => {
        if (!stand) return;
        const standId = stand.id || stand._id;
        try {
            const data = await http.get<any[]>(`/resources/stand/${standId}`);
            setResources(Array.isArray(data) ? data : (data as any)?.items || []);
        } catch { setResources([]); }
    };

    useEffect(() => { fetchAll(); }, [eventId]);
    useEffect(() => { if (stand) fetchResources(); }, [stand]);

    const saveBranding = async () => {
        setIsSaving(true); setMessage(null);
        try {
            await http.patch(`/enterprise/events/${eventId}/stand`, branding);
            setMessage({ type: 'success', text: 'Branding saved!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Save failed' });
        } finally { setIsSaving(false); }
    };

    const saveProducts = async () => {
        setIsSaving(true); setMessage(null);
        try {
            await http.patch(`/enterprise/events/${eventId}/stand/products`, linkedProducts);
            setMessage({ type: 'success', text: 'Products linked!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Save failed' });
        } finally { setIsSaving(false); }
    };

    const addResource = async () => {
        setMessage(null);
        if (!newResource.title) {
            setMessage({ type: 'error', text: 'Please provide a title for the resource.' });
            return;
        }
        if ((newResource.resource_type === 'video_url' || newResource.resource_type === 'link') && !newResource.url) {
            setMessage({ type: 'error', text: 'Please provide a valid URL for this resource tape.' });
            return;
        }
        if ((newResource.resource_type === 'pdf' || newResource.resource_type === 'image') && !newResource.file) {
            setMessage({ type: 'error', text: 'Please select a file to upload.' });
            return;
        }

        const standId = stand?.id || stand?._id;
        if (!standId) {
            setMessage({ type: 'error', text: 'Stand configuration not fully loaded yet.' });
            return;
        }
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('title', newResource.title);
            formData.append('type', newResource.resource_type);
            if (newResource.url) formData.append('url', newResource.url);
            if (newResource.file) formData.append('file', newResource.file);

            await http.post(`/enterprise/events/${eventId}/stand/resources`, formData);
            setNewResource({ title: '', resource_type: 'pdf', url: '', file: null });
            fetchResources();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to add resource' });
        } finally { setIsSaving(false); }
    };

    const enableAssistant = async () => {
        setRagLoading(true);
        try {
            const res = await http.post<any>(`/enterprise/events/${eventId}/stand/enable-assistant`, {});
            setRagStatus({ ...ragStatus, ...res });
            setMessage({ type: 'success', text: `AI assistant enabled! Indexed ${res.indexed_documents} document(s).` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'RAG activation failed' });
        } finally { setRagLoading(false); }
    };

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'branding', label: 'Branding', icon: <Palette size={16} /> },
        { id: 'products', label: 'Products', icon: <Package size={16} /> },
        { id: 'resources', label: 'Resources', icon: <FileText size={16} /> },
        { id: 'ai', label: 'AI Assistant', icon: <Cpu size={16} /> },
    ];

    if (isLoading) return (
        <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-500">Loading stand configuration...</p>
        </div>
    );

    if (!stand) return (
        <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
            <AlertCircle className="mx-auto text-red-300 mb-4" size={48} />
            <h3 className="text-lg font-bold text-red-900">Access Denied</h3>
            <p className="text-red-600 mt-2">Your participation must be approved before configuring a stand.</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20 mt-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white text-center shadow-lg">
                <h2 className="text-3xl font-extrabold mb-2">Configure Your Stand</h2>
                <p className="text-indigo-100">Managing: <span className="font-semibold text-white">{stand.name}</span></p>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setMessage(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Branding Tab */}
            {activeTab === 'branding' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-6">
                        <Input label="Stand Name" value={branding.name} onChange={(e) => setBranding(p => ({ ...p, name: e.target.value }))} />
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700">Description</label>
                            <textarea
                                value={branding.description}
                                onChange={(e) => setBranding(p => ({ ...p, description: e.target.value }))}
                                className="w-full min-h-[100px] p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                                placeholder="What will visitors find at your stand?"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Input label="Logo URL" value={branding.logo_url} onChange={(e) => setBranding(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
                            <Input label="Banner URL" value={branding.stand_background_url} onChange={(e) => setBranding(p => ({ ...p, stand_background_url: e.target.value }))} placeholder="https://..." />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Input label="Presenter Name" value={branding.presenter_name} onChange={(e) => setBranding(p => ({ ...p, presenter_name: e.target.value }))} />
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700">Theme Color</label>
                                <div className="flex gap-3 items-center">
                                    <input type="color" value={branding.theme_color} onChange={(e) => setBranding(p => ({ ...p, theme_color: e.target.value }))} className="w-12 h-12 rounded-lg cursor-pointer" />
                                    <span className="text-xs font-mono text-zinc-500">{branding.theme_color}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={saveBranding} isLoading={isSaving}>Save Branding</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-6">
                        <p className="text-sm text-zinc-500">Select which products from your catalog to display on this stand.</p>
                        <div className="space-y-3">
                            {myProducts.length === 0 ? (
                                <p className="text-zinc-400 text-sm text-center py-8">No products in your catalog yet. <a href="/enterprise/products" className="text-indigo-600 hover:underline">Add products first.</a></p>
                            ) : myProducts.map((prod) => {
                                const pid = prod.id || prod._id;
                                const isLinked = linkedProducts.includes(pid);
                                return (
                                    <div key={pid} onClick={() => setLinkedProducts(prev => isLinked ? prev.filter(id => id !== pid) : [...prev, pid])}
                                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isLinked ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isLinked ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300'}`}>
                                            {isLinked && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-zinc-900 text-sm">{prod.name}</h4>
                                            <p className="text-xs text-zinc-500">{prod.category} · {prod.price ? `$${prod.price}` : 'Quote Only'}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={saveProducts} isLoading={isSaving}>Save Selection ({linkedProducts.length})</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-zinc-700">Add Resource</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <Input label="Title" value={newResource.title} onChange={(e) => setNewResource(p => ({ ...p, title: e.target.value }))} placeholder="Product Brochure" />
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Type</label>
                                    <select value={newResource.resource_type} onChange={(e) => {
                                        const val = e.target.value;
                                        const isFile = val === 'pdf' || val === 'image';
                                        setNewResource(p => ({ ...p, resource_type: val, file: isFile ? p.file : null, url: !isFile ? p.url : '' }));
                                    }}
                                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm h-[46px]">
                                        <option value="pdf">PDF</option>
                                        <option value="image">Image</option>
                                        <option value="video_url">Video URL</option>
                                        <option value="link">Link</option>
                                    </select>
                                </div>
                                {(newResource.resource_type === 'video_url' || newResource.resource_type === 'link') ? (
                                    <Input label="URL / Link" value={newResource.url} onChange={(e) => setNewResource(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">Upload File</label>
                                        <input key={resources.length} type="file" onChange={(e) => setNewResource(p => ({ ...p, file: e.target.files?.[0] || null }))} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-[8px] file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                                    </div>
                                )}
                            </div>
                            <Button onClick={addResource} isLoading={isSaving} className="flex items-center gap-2">
                                <Plus size={16} /> Add Resource
                            </Button>
                        </div>
                        <div className="border-t pt-6 space-y-3">
                            {resources.length === 0 ? (
                                <p className="text-zinc-400 text-sm text-center py-4">No resources uploaded yet.</p>
                            ) : resources.map((r) => (
                                <div key={r.id || r._id} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                    <FileText size={18} className="text-zinc-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-zinc-900 text-sm truncate">{r.title}</p>
                                        <p className="text-xs text-zinc-400 truncate">{r.file_path}</p>
                                    </div>
                                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded font-medium">{r.type}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* AI Assistant Tab */}
            {activeTab === 'ai' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-8">
                        <div className={`p-6 rounded-2xl border-2 ${ragStatus?.rag_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ragStatus?.rag_enabled ? 'bg-emerald-600' : 'bg-zinc-200'}`}>
                                    <Cpu size={24} className={ragStatus?.rag_enabled ? 'text-white' : 'text-zinc-500'} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900">AI Assistant</h3>
                                    <p className={`text-sm font-medium ${ragStatus?.rag_enabled ? 'text-emerald-600' : 'text-zinc-500'}`}>
                                        {ragStatus?.rag_enabled ? '● Active' : '○ Inactive'}
                                    </p>
                                </div>
                            </div>
                            {ragStatus && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-white rounded-xl p-4 border border-zinc-100">
                                        <p className="text-zinc-500 text-xs mb-1">Indexed Documents</p>
                                        <p className="font-bold text-zinc-900 text-xl">{ragStatus.indexed_documents_count || 0}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-4 border border-zinc-100">
                                        <p className="text-zinc-500 text-xs mb-1">Last Indexed</p>
                                        <p className="font-bold text-zinc-900 text-sm">
                                            {ragStatus.last_indexed_at ? new Date(ragStatus.last_indexed_at).toLocaleDateString() : 'Never'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-600">
                                Enabling the AI assistant indexes all your stand resources into the vector database.
                                Visitors can then ask questions and receive answers based on your uploaded documents.
                            </p>
                            <Button onClick={enableAssistant} isLoading={ragLoading} className="flex items-center gap-2">
                                <Zap size={16} />
                                {ragStatus?.rag_enabled ? 'Re-index & Refresh AI' : 'Enable AI Assistant'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
