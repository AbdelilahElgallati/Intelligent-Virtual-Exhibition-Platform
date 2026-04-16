"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { resolveMediaUrl } from '@/lib/media';
import { http } from '@/lib/http';
import {
    Package, Tag, ShoppingCart, X,
    CheckCircle2, Send, Hash, Wrench, Image as ImageIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Product {
    id: string;
    name: string;
    description: string;
    category: string;
    is_service: boolean;
    price?: number;
    tags?: string[];
    images?: string[];
}

interface RequestModalProps {
    product: Product;
    eventId: string;
    onClose: () => void;
}

function RequestModal({ product, eventId, onClose }: RequestModalProps) {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const payload: any = {
                product_id: product.id,
                event_id: eventId,
                message,
            };
            // Only include quantity for products (not services)
            if (!product.is_service) {
                payload.quantity = quantity;
            }
            await http.post(`/enterprise/public/products/${product.id}/request`, payload);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || t('visitor.standCatalog.requestFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${product.is_service ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                            {product.is_service
                                ? <Wrench size={18} className="text-amber-600" />
                                : <Package size={18} className="text-emerald-600" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 text-sm">{product.name}</h3>
                            <span className={`text-[10px] font-bold ${product.is_service ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {product.is_service ? t('visitor.productsPanel.itemType.service') : t('visitor.productsPanel.itemType.product')}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400">
                        <X size={18} />
                    </button>
                </div>

                {success ? (
                    <div className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="font-bold text-zinc-900 mb-1">{t('visitor.standCatalog.requestSent')}</h4>
                            <p className="text-sm text-zinc-500">
                                {t('visitor.standCatalog.requestSentMessage')}
                            </p>
                        </div>
                        <Button onClick={onClose} variant="outline" className="mt-2">{t('visitor.standCatalog.close')}</Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Quantity — only for products */}
                        {!product.is_service && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                                    <Hash size={14} className="text-indigo-500" /> {t('visitor.productsPanel.columns.quantity')}
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        className="w-9 h-9 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-700 transition-colors"
                                    >
                                        −
                                    </button>
                                    <span className="text-xl font-bold text-zinc-900 min-w-[2rem] text-center">{quantity}</span>
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(q => q + 1)}
                                        className="w-9 h-9 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-700 transition-colors"
                                    >
                                        +
                                    </button>
                                    {product.price && (
                                        <span className="ml-auto text-sm font-bold text-indigo-600">
                                            {formatMAD(product.price * quantity)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700">
                                Message <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                required
                                rows={4}
                                placeholder={
                                    product.is_service
                                        ? t('visitor.standCatalog.servicePlaceholder')
                                        : t('visitor.standCatalog.productPlaceholder')
                                }
                                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-1">
                            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                                {t('common.actions.cancel')}
                            </Button>
                            <Button type="submit" isLoading={loading} className="flex-1 flex items-center gap-2">
                                <Send size={15} /> {t('visitor.networkingTab.reachOutModal.submit')}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

interface StandCatalogProps {
    products: Product[];
    eventId: string;
    isLoggedIn?: boolean;
}

function formatMAD(amount: number): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
}

export function StandCatalog({ products, eventId, isLoggedIn = true }: StandCatalogProps) {
    const { t } = useTranslation();
    const [requestingProduct, setRequestingProduct] = useState<Product | null>(null);

    if (!products || products.length === 0) return null;

    return (
        <>
            <div className="space-y-3">
                {products.map(product => (
                    <div
                        key={product.id}
                        className="flex gap-4 p-4 bg-white rounded-xl border border-zinc-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
                    >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden">
                            {product.images?.[0] ? (
                                <img
                                    src={resolveMediaUrl(product.images[0])}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = '/stands/office-bg.jpg';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    {product.is_service
                                        ? <Wrench size={22} className="text-amber-400" />
                                        : <Package size={22} className="text-emerald-400" />}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h4 className="font-semibold text-zinc-900 text-sm leading-tight">{product.name}</h4>
                                    <span className={`text-[10px] font-bold ${product.is_service ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {product.is_service ? t('visitor.productsPanel.itemType.service') : t('visitor.productsPanel.itemType.product')}
                                    </span>
                                </div>
                                {product.price !== undefined && product.price !== null && (
                                    <span className="text-sm font-bold text-indigo-600 flex items-center gap-0.5 flex-shrink-0">{formatMAD(product.price)}</span>
                                )}
                            </div>

                            {product.description && (
                                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{product.description}</p>
                            )}

                            {product.tags && product.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {product.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3">
                                <Button
                                    size="sm"
                                    onClick={() => setRequestingProduct(product)}
                                    disabled={!isLoggedIn}
                                    className="text-xs h-8 px-3 flex items-center gap-1.5"
                                    title={!isLoggedIn ? t('visitor.standCatalog.signInToRequest') : undefined}
                                >
                                    {product.is_service
                                        ? <><Wrench size={12} /> {t('visitor.standCatalog.requestService')}</>
                                        : <><ShoppingCart size={12} /> {t('visitor.standCatalog.requestProduct')}</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {requestingProduct && (
                <RequestModal
                    product={requestingProduct}
                    eventId={eventId}
                    onClose={() => setRequestingProduct(null)}
                />
            )}
        </>
    );
}
