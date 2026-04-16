"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import { formatInUserTZ } from '@/lib/timezone';
import { getEventLifecycle } from '@/lib/eventLifecycle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Palette, Package, FileText, Cpu, CheckCircle2,
    Plus, Trash2, Upload, Zap, AlertCircle,
    BarChart3, MessageSquare, ChevronLeft, Play, ExternalLink
} from 'lucide-react';

type Tab = 'branding' | 'products' | 'resources' | 'ai';

interface ProductSelection {
    product_id: string;
    quantity?: number | null;
}

interface BrandingState {
    name: string;
    description: string;
    logo_url: string;
    theme_color: string;
    stand_background_url: string;
    presenter_name: string;
    presenter_avatar_url: string;
}

interface BrandingPreset {
    label: string;
    value: string;
}

const STAND_BACKGROUND_PRESETS: BrandingPreset[] = [
    { label: 'Wood Wave Desk', value: '/stands/stand_background.jpg' },
    { label: 'Neon White Tech', value: '/stands/stand_background_2.png' },
    { label: 'Neon Dark Tech', value: '/stands/stand_background_3.png' },
    { label: 'Classic Wood Desk', value: '/stands/stand_background_4.jpg' },
    { label: 'Office Stand', value: '/stands/office-stand.jpeg' },
];

const PRESENTER_AVATAR_PRESETS: BrandingPreset[] = [
    { label: 'Male Presenter', value: '/stands/male-presenter.png' },
    { label: 'Female Presenter', value: '/stands/female-presenter.png' },
];

export default function StandConfigPage() {
    const { t } = useTranslation('enterprise');
    const params = useParams();
    const eventId = params?.eventId as string;

    const [event, setEvent] = useState<any | null>(null);
    const [stand, setStand] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('branding');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const logoFileInputRef = useRef<HTMLInputElement>(null);

    // Branding state
    const [branding, setBranding] = useState<BrandingState>({
        name: '',
        description: '',
        logo_url: '',
        theme_color: '#4f46e5',
        stand_background_url: '',
        presenter_name: '',
        presenter_avatar_url: '',
    });

    // Products state
    const [myProducts, setMyProducts] = useState<any[]>([]);
    const [linkedProducts, setLinkedProducts] = useState<ProductSelection[]>([]);

    // Resources state
    const [resources, setResources] = useState<any[]>([]);
    const [newResource, setNewResource] = useState({ title: '', resource_type: 'pdf', url: '', file: null as File | null });

    // RAG state
    const [ragStatus, setRagStatus] = useState<any>(null);
    const [ragLoading, setRagLoading] = useState(false);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [eventData, standData, ragData, productsData] = await Promise.allSettled([
                http.get<any>(`/events/${eventId}`),
                http.get<any>(`/enterprise/events/${eventId}/stand`),
                http.get<any>(`/enterprise/events/${eventId}/stand/assistant-status`),
                http.get<any>('/enterprise/products'),
            ]);
            
            if (eventData.status === 'fulfilled') setEvent(eventData.value);

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
                    presenter_avatar_url: s.presenter_avatar_url || '',
                });
                const savedLinks = Array.isArray(s.product_links) ? s.product_links : [];
                if (savedLinks.length > 0) {
                    setLinkedProducts(
                        savedLinks
                            .filter((link: any) => Boolean(link?.product_id))
                            .map((link: any) => ({
                                product_id: String(link.product_id),
                                quantity: link.quantity ?? null,
                            }))
                    );
                } else {
                    const fallbackIds = Array.isArray(s.products) ? s.products : [];
                    setLinkedProducts(
                        fallbackIds
                            .filter((pid: any) => typeof pid === 'string')
                            .map((pid: string) => ({ product_id: pid, quantity: 1 }))
                    );
                }
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
            setMessage({ type: 'success', text: t('enterprise.stand.messages.brandingSaved') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Save failed' });
        } finally { setIsSaving(false); }
    };

    const uploadLogoFromFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: t('enterprise.stand.messages.logoChooseError') });
            return;
        }

        setIsUploadingLogo(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const data = await http.post<{ logo_url: string }>(`/enterprise/profile/logo`, formData);
            const logoUrl = data?.logo_url || '';
            if (!logoUrl) {
                throw new Error(t('enterprise.stand.messages.logoUploadError'));
            }
            setBranding((p) => ({ ...p, logo_url: logoUrl }));
            setMessage({ type: 'success', text: t('enterprise.stand.messages.logoUploadSuccess') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || t('enterprise.stand.messages.logoUploadFailed') });
        } finally {
            setIsUploadingLogo(false);
            if (logoFileInputRef.current) logoFileInputRef.current.value = '';
        }
    };

    const saveProducts = async () => {
        setIsSaving(true); setMessage(null);
        try {
            const invalid = linkedProducts.find((entry) => {
                const prod = myProducts.find((p) => (p.id || p._id) === entry.product_id);
                if (!prod) return false;
                const isService = (prod.type || 'product') === 'service';
                if (isService) return false;
                const stock = Math.max(0, Number(prod.stock || 0));
                const qty = Number(entry.quantity || 0);
                return qty < 1 || qty > stock;
            });
            if (invalid) {
                const prod = myProducts.find((p) => (p.id || p._id) === invalid.product_id);
                setMessage({
                    type: 'error',
                    text: `Invalid quantity for ${prod?.name || 'a product'}. Please choose a value between 1 and available stock.`,
                });
                return;
            }

            await http.patch(`/enterprise/events/${eventId}/stand/products`, linkedProducts);
            setMessage({ type: 'success', text: t('enterprise.stand.messages.productsLinked') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Save failed' });
        } finally { setIsSaving(false); }
    };

    const isProductLinked = (productId: string) => linkedProducts.some((entry) => entry.product_id === productId);

    const toggleProductLink = (product: any) => {
        const pid = product.id || product._id;
        const isService = (product.type || 'product') === 'service';
        const stock = Math.max(0, Number(product.stock || 0));
        setLinkedProducts((prev) => {
            const exists = prev.some((entry) => entry.product_id === pid);
            if (exists) {
                return prev.filter((entry) => entry.product_id !== pid);
            }
            if (!isService && stock <= 0) {
                return prev;
            }
            return [...prev, { product_id: pid, quantity: isService ? null : stock }];
        });
    };

    const updateLinkedQuantity = (productId: string, nextQuantity: number) => {
        setLinkedProducts((prev) =>
            prev.map((entry) => {
                if (entry.product_id !== productId) return entry;
                const prod = myProducts.find((p) => (p.id || p._id) === productId);
                const stock = Math.max(0, Number(prod?.stock || 0));
                return { ...entry, quantity: Math.min(Math.max(1, nextQuantity), Math.max(1, stock)) };
            })
        );
    };

    const addResource = async () => {
        setMessage(null);
        if (!newResource.title) {
            setMessage({ type: 'error', text: t('enterprise.stand.messages.resourceTitleRequired') });
            return;
        }
        if ((newResource.resource_type === 'video_url' || newResource.resource_type === 'link') && !newResource.url) {
            setMessage({ type: 'error', text: t('enterprise.stand.messages.resourceUrlRequired') });
            return;
        }
        if ((newResource.resource_type === 'pdf' || newResource.resource_type === 'image') && !newResource.file) {
            setMessage({ type: 'error', text: 'Please select a file to upload.' });
            return;
        }

        const standId = stand?.id || stand?._id;
        if (!standId) {
            setMessage({ type: 'error', text: t('enterprise.stand.messages.standConfigNotLoaded') });
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
            setMessage({ type: 'success', text: t('enterprise.stand.messages.aiActivationSuccess', { indexed_documents: res.indexed_documents }) });
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
            <p className="text-zinc-500">{t('enterprise.stand.messages.loadingStandConfig')}</p>
        </div>
    );

    if (!stand) return (
        <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
            <AlertCircle className="mx-auto text-red-300 mb-4" size={48} />
            <h3 className="text-lg font-bold text-red-900">{t('enterprise.stand.messages.accessDenied')}</h3>
            <p className="text-red-600 mt-2">{t('enterprise.stand.messages.accessDeniedReason')}</p>
        </div>
    );

    const lifecycle = event ? getEventLifecycle(event) : null;
    const isLive = lifecycle?.displayState === 'LIVE';

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20 mt-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <h2 className="text-3xl font-extrabold mb-2">{t('enterprise.stand.labels.configureYourStand')}</h2>
                        <p className="text-indigo-100">Managing: <span className="font-semibold text-white">{stand.name}</span></p>
                    </div>
                    {/* Shortcut buttons */}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-2 sm:mt-0">
                        {isLive && (
                            <Link href={`/enterprise/events/${eventId}/manage`}>
                                <button className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl border border-white/30 transition-all backdrop-blur-sm">
                                    <MessageSquare size={15} /> {t('enterprise.stand.labels.manageEvent')}
                                </button>
                            </Link>
                        )}
                        <Link href={`/enterprise/events/${eventId}/analytics`}>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl border border-white/30 transition-all backdrop-blur-sm">
                                <BarChart3 size={15} /> {t('enterprise.stand.labels.analytics')}
                            </button>
                        </Link>
                        <Link href="/enterprise/events">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium rounded-xl border border-white/20 transition-all backdrop-blur-sm">
                                <ChevronLeft size={15} /> {t('enterprise.stand.labels.allEvents')}
                            </button>
                        </Link>
                    </div>
                </div>
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
                                placeholder={t('enterprise.stand.labels.companyBioPlaceholder')}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Input
                                    label={t('enterprise.stand.labels.logoUrl')}
                                    value={branding.logo_url}
                                    onChange={(e) => setBranding(p => ({ ...p, logo_url: e.target.value }))}
                                    placeholder={t('enterprise.stand.labels.logoUrlPlaceholder')}
                                />
                                <div className="flex items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        isLoading={isUploadingLogo}
                                        onClick={() => logoFileInputRef.current?.click()}
                                        className="flex items-center gap-2"
                                    >
                                        <Upload size={14} /> {t('enterprise.stand.labels.uploadLogoImage')}
                                    </Button>
                                    <span className="text-xs text-zinc-500">{t('enterprise.stand.labels.uploadLogoHelper')}</span>
                                </div>
                                <input
                                    ref={logoFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadLogoFromFile(file);
                                    }}
                                />
                            </div>
                            <Input label="Custom Background URL" value={branding.stand_background_url} onChange={(e) => setBranding(p => ({ ...p, stand_background_url: e.target.value }))} placeholder="https://... or /stands/..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-zinc-700">{t('enterprise.stand.labels.standBackgroundPresets')}</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {STAND_BACKGROUND_PRESETS.map((preset) => {
                                    const isSelected = branding.stand_background_url === preset.value;
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setBranding((p) => ({ ...p, stand_background_url: preset.value }))}
                                            className={`rounded-xl border p-2 text-left transition ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-indigo-300'}`}
                                        >
                                            <img src={preset.value} alt={preset.label} className="w-full h-20 rounded-lg object-cover mb-2" />
                                            <p className="text-xs font-medium text-zinc-700">{preset.label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Input label={t('enterprise.stand.branding.presenterName')} value={branding.presenter_name} onChange={(e) => setBranding(p => ({ ...p, presenter_name: e.target.value }))} />
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700">Theme Color</label>
                                <div className="flex gap-3 items-center">
                                    <input type="color" value={branding.theme_color} onChange={(e) => setBranding(p => ({ ...p, theme_color: e.target.value }))} className="w-12 h-12 rounded-lg cursor-pointer" />
                                    <span className="text-xs font-mono text-zinc-500">{branding.theme_color}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-zinc-700">Presenter Avatar</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setBranding((p) => ({ ...p, presenter_avatar_url: '' }))}
                                    className={`rounded-xl border p-3 text-left transition ${branding.presenter_avatar_url === '' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-indigo-300'}`}
                                >
                                    <p className="text-sm font-semibold text-zinc-800">Auto</p>
                                    <p className="text-xs text-zinc-500 mt-1">Use the default avatar selection.</p>
                                </button>
                                {PRESENTER_AVATAR_PRESETS.map((preset) => {
                                    const isSelected = branding.presenter_avatar_url === preset.value;
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setBranding((p) => ({ ...p, presenter_avatar_url: preset.value }))}
                                            className={`rounded-xl border p-2 text-left transition ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-indigo-300'}`}
                                        >
                                            <img src={preset.value} alt={preset.label} className="w-full h-28 rounded-lg object-contain bg-zinc-50 mb-2" />
                                            <p className="text-xs font-medium text-zinc-700">{preset.label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                            <Input
                                label="Custom Avatar URL"
                                value={branding.presenter_avatar_url}
                                onChange={(e) => setBranding((p) => ({ ...p, presenter_avatar_url: e.target.value }))}
                                placeholder="https://... or /stands/..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={saveBranding} isLoading={isSaving}>{t('enterprise.stand.labels.saveBranding')}</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-6">
                        <p className="text-sm text-zinc-500">{t('enterprise.stand.labels.selectProductsDescription')}</p>
                        <div className="space-y-3">
                            {myProducts.length === 0 ? (
                                <p className="text-zinc-400 text-sm text-center py-8">{t('enterprise.stand.labels.noProductsInCatalog')} <a href="/enterprise/products" className="text-indigo-600 hover:underline">{t('enterprise.stand.labels.addProductsFirst')}</a></p>
                            ) : myProducts.map((prod) => {
                                const pid = prod.id || prod._id;
                                const isLinked = isProductLinked(pid);
                                const isService = (prod.type || 'product') === 'service';
                                const stock = Math.max(0, Number(prod.stock || 0));
                                const linkedEntry = linkedProducts.find((entry) => entry.product_id === pid);
                                return (
                                    <div key={pid} onClick={() => toggleProductLink(prod)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isLinked ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isLinked ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300'}`}>
                                            {isLinked && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-zinc-900 text-sm">{prod.name}</h4>
                                            <p className="text-xs text-zinc-500">{prod.category} · {prod.price ? `${prod.price} MAD` : 'Quote Only'} · {(prod.type || 'product') === 'service' ? t('enterprise.stand.labels.productTypeService') : `${t('enterprise.stand.labels.productTypeProduct')} · ${stock} ${t('enterprise.stand.labels.productStatusAvailable')}`}</p>
                                            {!isService && stock <= 0 && (
                                                <p className="text-[11px] text-red-600 mt-1 font-semibold">{t('enterprise.stand.labels.productOutOfStock')}</p>
                                            )}
                                            {!isService && isLinked && (
                                                <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('enterprise.stand.labels.quantityLabel')}</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={Math.max(1, stock)}
                                                        value={Math.min(linkedEntry?.quantity ?? 1, Math.max(1, stock))}
                                                        onChange={(e) => updateLinkedQuantity(pid, parseInt(e.target.value || '1', 10) || 1)}
                                                        className="h-8 w-24 rounded-md border border-indigo-200 bg-white px-2 text-xs font-semibold text-zinc-700"
                                                    />
                                                    <span className="text-[11px] text-zinc-500">{t('enterprise.stand.labels.quantityMaxLabel')} {stock}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={saveProducts} isLoading={isSaving}>{t('enterprise.stand.labels.saveSelectionButton', { count: linkedProducts.length })}</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
                <Card className="border-zinc-200">
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-zinc-700">{t('enterprise.stand.labels.addResource')}</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <Input label="Title" value={newResource.title} onChange={(e) => setNewResource(p => ({ ...p, title: e.target.value }))} placeholder={t('enterprise.stand.labels.resourcePlaceholder')} />
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('enterprise.stand.labels.resourceTypeLabel')}</label>
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
                                    <Input label="URL / Link" value={newResource.url} onChange={(e) => setNewResource(p => ({ ...p, url: e.target.value }))} placeholder={t('enterprise.stand.labels.urlPlaceholder')} />
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.stand.labels.uploadFileLabel')}</label>
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
                                <p className="text-zinc-400 text-sm text-center py-4">{t('enterprise.stand.labels.noResourcesUploaded')}</p>
                            ) : resources.map((r) => {
                                const isVideo = r.type === 'video' || r.type === 'video_url';
                                const isLink = r.type === 'link';
                                return (
                                    <div key={r.id || r._id} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                        {isVideo ? (
                                            <Play size={18} className="text-zinc-400 shrink-0" />
                                        ) : isLink ? (
                                            <ExternalLink size={18} className="text-zinc-400 shrink-0" />
                                        ) : (
                                            <FileText size={18} className="text-zinc-400 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-zinc-900 text-sm truncate">{r.title}</p>
                                            <a
                                                href={resolveMediaUrl(r.file_path)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 hover:underline truncate block"
                                            >
                                                {r.file_path}
                                            </a>
                                        </div>
                                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded font-medium">{r.type}</span>
                                    </div>
                                );
                            })}
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
                                    <h3 className="font-bold text-zinc-900">{t('enterprise.stand.labels.aiAssistantHeading')}</h3>
                                    <p className={`text-sm font-medium ${ragStatus?.rag_enabled ? 'text-emerald-600' : 'text-zinc-500'}`}>
                                        {ragStatus?.rag_enabled ? `● ${t('enterprise.stand.labels.statusActive')}` : `○ ${t('enterprise.stand.labels.statusInactive')}`}
                                    </p>
                                </div>
                            </div>
                            {ragStatus && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-white rounded-xl p-4 border border-zinc-100">
                                        <p className="text-zinc-500 text-xs mb-1">{t('enterprise.stand.labels.indexedDocuments')}</p>
                                        <p className="font-bold text-zinc-900 text-xl">{ragStatus.indexed_documents_count || 0}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-4 border border-zinc-100">
                                        <p className="text-zinc-500 text-xs mb-1">{t('enterprise.stand.labels.lastIndexed')}</p>
                                        <p className="font-bold text-zinc-900 text-sm">
                                            {ragStatus.last_indexed_at ? formatInUserTZ(ragStatus.last_indexed_at, { year: 'numeric', month: 'short', day: 'numeric' }) : t('enterprise.stand.labels.never')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-600">
                                {t('enterprise.stand.labels.aiDescription')}
                            </p>
                            <Button onClick={enableAssistant} isLoading={ragLoading} className="flex items-center gap-2">
                                <Zap size={16} />
                                {ragStatus?.rag_enabled ? t('enterprise.stand.labels.reindexRefreshAi') : t('enterprise.stand.labels.enableAiAssistant')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
