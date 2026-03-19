"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import {
    Package, Plus, Trash2, Edit2, X, Image as ImageIcon,
    Upload
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EnterpriseProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        currency: 'MAD',
        stock: '',
        type: 'product' as 'product' | 'service',
    });
    const [pendingImage, setPendingImage] = useState<File | null>(null);
    const [pendingPreview, setPendingPreview] = useState<string>('');
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

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingImage(file);
        setPendingPreview(URL.createObjectURL(file));
    };

    const removePendingImage = () => {
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingImage(null);
        setPendingPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: '', description: '', price: '', currency: 'MAD', stock: '', type: 'product' });
        removePendingImage();
    };

    const uploadImage = async (productId: string, file: File): Promise<string> => {
        const form = new FormData();
        form.append('file', file);
        const res = await http.post<{ image_url: string }>(`/enterprise/products/${productId}/image`, form);
        return res.image_url;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                name: formData.name,
                description: formData.description,
                price: Number.parseFloat(formData.price) || 0,
                currency: formData.currency || 'MAD',
                stock: formData.type === 'service' ? 0 : (Number.parseInt(formData.stock, 10) || 0),
                type: formData.type,
                image_url: editingProduct?.image_url || '',
            };

            let productId: string;
            if (editingProduct) {
                const res = await http.patch<any>(`/enterprise/products/${editingProduct.id}`, payload);
                productId = res.id || editingProduct.id;
            } else {
                const res = await http.post<any>('/enterprise/products', payload);
                productId = res.id || res._id;
            }

            // Upload image if pending
            if (pendingImage && productId) {
                await uploadImage(productId, pendingImage);
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

    const startEdit = (product: any) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            price: product.price?.toString() || '',
            currency: product.currency || 'MAD',
            stock: product.stock?.toString() || '',
            type: product.type || 'product',
        });
        setPendingImage(null);
        setPendingPreview('');
        setIsAdding(true);
    };

    /* ── Initial loading ── */
    if (isLoading) {
        return (
            <div className="text-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">Loading catalog...</p>
            </div>
        );
    }

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
                                    <label className="text-sm font-semibold text-zinc-700">Description</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full min-h-[100px] p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="Briefly describe what this is..."
                                    />
                                </div>

                                <Input
                                    label="Price *"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    type="number"
                                    placeholder="99.99"
                                    required
                                />

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Currency</label>
                                    <select
                                        name="currency"
                                        value={formData.currency}
                                        onChange={handleChange}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    >
                                        <option value="MAD">MAD</option>
                                    </select>
                                </div>

                                {formData.type !== 'service' ? (
                                    <Input
                                        label="Stock (quantity available)"
                                        name="stock"
                                        value={formData.stock}
                                        onChange={handleChange}
                                        type="number"
                                        placeholder="100"
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">Stock</label>
                                        <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-500">
                                            Not applicable for services
                                        </div>
                                    </div>
                                )}

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Type *</label>
                                    <div className="flex gap-0 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'product' }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all ${formData.type === 'product'
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700'
                                                }`}
                                        >
                                            <Package size={15} /> Product
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, type: 'service', stock: '' }))}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-l border-zinc-200 ${formData.type === 'service'
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-700'
                                                }`}
                                        >
                                            ⚙️ Service
                                        </button>
                                    </div>
                                </div>

                                {/* Single Image Upload */}
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                        <ImageIcon size={15} className="text-indigo-500" /> Image
                                    </label>

                                    {/* Current image (edit mode) */}
                                    {editingProduct?.image_url && !pendingPreview && (
                                        <div className="flex gap-3 mb-2">
                                            <div className="relative group w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                                                <img
                                                    src={editingProduct.image_url.startsWith('http') ? editingProduct.image_url : `${API_BASE}${editingProduct.image_url}`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-white text-[10px] font-semibold">Current</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pending new image */}
                                    {pendingPreview && (
                                        <div className="flex gap-3 mb-2">
                                            <div className="relative group w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-indigo-300">
                                                <img src={pendingPreview} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={removePendingImage}
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <div className="absolute bottom-1 right-1 bg-indigo-500 rounded-full p-0.5">
                                                    <Upload size={10} className="text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <label className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                                        <Upload size={18} className="text-indigo-500 flex-shrink-0" />
                                        <span className="text-sm text-zinc-500">
                                            {pendingImage
                                                ? 'Image selected — click to replace'
                                                : 'Click to upload a product image (JPG, PNG, WebP)'}
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
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
            {products.length === 0 ? (
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
                    {products.map((p) => {
                        const imgSrc = p.image_url
                            ? (p.image_url.startsWith('http') ? p.image_url : `${API_BASE}${p.image_url}`)
                            : '';

                        return (
                            <Card key={p.id} className="group hover:border-indigo-200 transition-all overflow-hidden border-zinc-200 flex flex-col">
                                <CardContent className="p-0 flex flex-col h-full">
                                    {/* Image */}
                                    {imgSrc ? (
                                        <div className="relative h-44 w-full overflow-hidden bg-zinc-100">
                                            <img
                                                src={imgSrc}
                                                alt={p.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-24 w-full bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center border-b border-zinc-100">
                                            <ImageIcon size={28} className="text-zinc-200" />
                                        </div>
                                    )}

                                    <div className="p-5 flex flex-col flex-1 gap-3">
                                        <div className="flex justify-between items-start">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${p.type === 'service' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                {p.type === 'service' ? 'Service' : 'Product'}
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

                                        <div className="flex-1" />

                                        <div className="flex justify-between items-center pt-3 border-t border-zinc-50">
                                            {p.type !== 'service' && p.stock != null && (
                                                <span className="text-xs text-zinc-500 font-medium">
                                                    {p.stock} in stock
                                                </span>
                                            )}
                                            <span className="font-bold text-indigo-600 text-sm flex items-center gap-0.5 ml-auto">
                                                {p.price
                                                    ? <>{p.price.toLocaleString()} MAD</>
                                                    : <span className="text-zinc-400 font-normal text-xs">No price</span>}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
