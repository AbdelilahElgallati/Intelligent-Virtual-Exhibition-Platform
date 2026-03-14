"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import {
    Package, Plus, Trash2, Edit2, X, Image as ImageIcon,
    Upload, CheckCircle2, Tag, DollarSign
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EnterpriseProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [savingImages, setSavingImages] = useState<Record<string, boolean>>({});
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: '',
        is_service: false,
        price: '',
        stock: '',
        tags: '',
    });
    const [pendingImages, setPendingImages] = useState<File[]>([]);
    const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const data = await http.get<any>('/enterprise/products');
            setProducts(data.products || []);
        } catch (err) {
            console.error('Failed to fetch products', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : e.target.value;
        setFormData(prev => ({ ...prev, [e.target.name]: value }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setPendingImages(prev => [...prev, ...files]);
        setPendingPreviews(prev => [...prev, ...newPreviews]);
    };

    const removePendingImage = (idx: number) => {
        URL.revokeObjectURL(pendingPreviews[idx]);
        setPendingImages(prev => prev.filter((_, i) => i !== idx));
        setPendingPreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: '', description: '', category: '', is_service: false, price: '', stock: '', tags: '' });
        setPendingImages([]);
        setPendingPreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadImages = async (productId: string, files: File[]) => {
        let token: string | null = null;
        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                token = parsed.access_token;
            }
        } catch (e) {
            console.error('Failed to get auth token for image upload', e);
        }
        if (!token) {
            console.error('No auth token available for image upload');
            return;
        }
        for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            await fetch(`${API_BASE}/api/v1/enterprise/products/${productId}/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                name: formData.name,
                description: formData.description,
                category: formData.category,
                is_service: formData.is_service,
                price: formData.price ? parseFloat(formData.price) : undefined,
                stock: (!formData.is_service && formData.stock) ? parseInt(formData.stock) : null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            };

            let productId: string;
            if (editingProduct) {
                const res = await http.patch<any>(`/enterprise/products/${editingProduct.id}`, payload);
                productId = res.id || editingProduct.id;
            } else {
                const res = await http.post<any>('/enterprise/products', payload);
                productId = res.id || res._id;
            }

            // Upload any pending images
            if (pendingImages.length > 0 && productId) {
                await uploadImages(productId, pendingImages);
            }

            resetForm();
            fetchProducts();
        } catch (err) {
            console.error('Failed to save product', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await http.delete(`/enterprise/products/${id}`);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete product', err);
        }
    };

    const handleRemoveProductImage = async (productId: string, imageUrl: string) => {
        setSavingImages(prev => ({ ...prev, [imageUrl]: true }));
        try {
            await http.delete(`/enterprise/products/${productId}/images?image_url=${encodeURIComponent(imageUrl)}`);
            fetchProducts();
        } catch (err) {
            console.error('Failed to remove image', err);
        } finally {
            setSavingImages(prev => { const n = { ...prev }; delete n[imageUrl]; return n; });
        }
    };

    const startEdit = (product: any) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            category: product.category,
            is_service: product.is_service,
            price: product.price?.toString() || '',
            stock: product.stock?.toString() || '',
            tags: (product.tags || []).join(', '),
        });
        setPendingImages([]);
        setPendingPreviews([]);
        setIsAdding(true);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <p className="text-zinc-500 text-sm">Manage your catalog of products and services.</p>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2">
                        <Plus size={18} /> Add Product
                    </Button>
                )}
            </div>

            {/* Add / Edit Form */}
            {isAdding && (
                <Card className="border-indigo-100 shadow-lg shadow-indigo-50 animate-in fade-in zoom-in duration-300">
                    <CardContent className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-zinc-900">
                                {editingProduct ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <button onClick={resetForm} className="text-zinc-400 hover:text-zinc-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <Input
                                        label="Product / Service Name *"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Cloud Analytics Suite"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Description *</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full min-h-[100px] p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="Briefly describe what this is..."
                                        required
                                    />
                                </div>

                                <Input
                                    label="Category *"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    placeholder="Software / Consulting"
                                    required
                                />
                                <Input
                                    label="Price (Optional)"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    type="number"
                                    placeholder="99.99"
                                />
                                {!formData.is_service && (
                                    <Input
                                        label="Stock (pieces available)"
                                        name="stock"
                                        value={formData.stock}
                                        onChange={handleChange}
                                        type="number"
                                        placeholder="100"
                                    />
                                )}
                                <div className="md:col-span-2">
                                    <Input
                                        label="Tags (comma-separated)"
                                        name="tags"
                                        value={formData.tags}
                                        onChange={handleChange}
                                        placeholder="AI, SaaS, Analytics"
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Type *</label>
                                    <div className="flex gap-0 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, is_service: false }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all ${!formData.is_service
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700'
                                                }`}
                                        >
                                            <Package size={15} /> Product
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, is_service: true }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-l border-zinc-200 ${formData.is_service
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700'
                                                }`}
                                        >
                                            ⚙️ Service
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-400">
                                        {formData.is_service
                                            ? 'Services don\'t require a quantity when visitors request them.'
                                            : 'Products include a quantity field when visitors place a request.'}
                                    </p>
                                </div>

                                {/* Image Upload */}
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                        <ImageIcon size={15} className="text-indigo-500" /> Images
                                    </label>

                                    {/* Existing images (edit mode) */}
                                    {editingProduct?.images?.length > 0 && (
                                        <div className="flex flex-wrap gap-3 mb-2">
                                            {editingProduct.images.map((url: string) => (
                                                <div key={url} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                                                    <img
                                                        src={resolveMediaUrl(url)}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductImage(editingProduct.id, url)}
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pending new images */}
                                    {pendingPreviews.length > 0 && (
                                        <div className="flex flex-wrap gap-3 mb-2">
                                            {pendingPreviews.map((src, idx) => (
                                                <div key={idx} className="relative group w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-indigo-300">
                                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removePendingImage(idx)}
                                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                    <div className="absolute bottom-1 right-1 bg-indigo-500 rounded-full p-0.5">
                                                        <Upload size={10} className="text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <label className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                                        <Upload size={18} className="text-indigo-500 flex-shrink-0" />
                                        <span className="text-sm text-zinc-500">
                                            {pendingImages.length > 0
                                                ? `${pendingImages.length} image(s) selected — click to add more`
                                                : 'Click to upload product images (JPG, PNG, WebP)'}
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                                <Button type="submit">
                                    {editingProduct ? 'Update Product' : 'Create Product'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Product Grid */}
            {isLoading ? (
                <div className="text-center py-20">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500">Loading catalog...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-20 text-center">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package className="text-zinc-300" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">No products yet</h3>
                    <p className="text-zinc-500 max-w-xs mx-auto mb-8">
                        Start by adding your first product or service.
                    </p>
                    <Button onClick={() => setIsAdding(true)} variant="outline">Add First Product</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => (
                        <Card key={p.id} className="group hover:border-indigo-200 transition-all overflow-hidden border-zinc-200 flex flex-col">
                            <CardContent className="p-0 flex flex-col h-full">
                                {/* Image gallery */}
                                {p.images?.length > 0 ? (
                                    <div className="relative h-44 w-full overflow-hidden bg-zinc-100">
                                        <img
                                            src={resolveMediaUrl(p.images[0])}
                                            alt={p.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {p.images.length > 1 && (
                                            <div className="absolute bottom-2 right-2 flex gap-1">
                                                {p.images.slice(1, 4).map((img: string, idx: number) => (
                                                    <div key={idx} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow">
                                                        <img src={resolveMediaUrl(img)} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                                {p.images.length > 4 && (
                                                    <div className="w-10 h-10 rounded-lg bg-black/60 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                                                        +{p.images.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-24 w-full bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center border-b border-zinc-100">
                                        <ImageIcon size={28} className="text-zinc-200" />
                                    </div>
                                )}

                                <div className="p-5 flex flex-col flex-1 gap-3">
                                    <div className="flex justify-between items-start">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${p.is_service ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {p.is_service ? 'Service' : 'Product'}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => startEdit(p)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors">
                                                <Edit2 size={15} />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-zinc-900 text-sm mb-1">{p.name}</h4>
                                        <p className="text-zinc-500 text-xs line-clamp-2">{p.description}</p>
                                    </div>

                                    {/* Tags */}
                                    {p.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {p.tags.slice(0, 4).map((tag: string) => (
                                                <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex-1" />

                                    <div className="flex justify-between items-center pt-3 border-t border-zinc-50">
                                        <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                                            <Tag size={11} /> {p.category}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            {!p.is_service && p.stock != null && (
                                                <span className="text-xs text-zinc-500 font-medium">
                                                    {p.stock} pcs
                                                </span>
                                            )}
                                            <span className="font-bold text-indigo-600 text-sm flex items-center gap-0.5">
                                                {p.price
                                                    ? <><DollarSign size={13} />{p.price}</>
                                                    : <span className="text-zinc-400 font-normal text-xs">Quote Only</span>
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
