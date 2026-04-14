import React, { useCallback, useEffect, useRef, useState } from "react";
import { inventoryApi } from "../api/client";
import { useToast } from "../App";
import { CameraCapture } from "../components/CameraCapture";

interface Item { id: string; name: string; quantity: string; unit: string; category: string; emoji?: string; expiry_label: string; expiry_days: number | null; }

const emojis: Record<string, string> = {
    produce: "🥦", dairy: "🧀", protein: "🥩", pantry: "🫙", frozen: "🧊",
    condiment: "🫙", beverage: "🧃", other: "📦",
};

export default function Inventory() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [suggestedPurchases, setSuggestedPurchases] = useState<string[]>([]);
    const [filterExpiry, setFilterExpiry] = useState<"all" | "urgent" | "soon" | "ok">("all");
    const fileRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const load = () => inventoryApi.list().then(r => setItems(r.data || [])).catch(console.error).finally(() => setLoading(false));

    useEffect(() => { load(); }, []);

    const handleFile = useCallback(async (file: File) => {
        if (!file.type.startsWith("image/")) { showToast("Please upload an image file"); return; }
        setPreview(URL.createObjectURL(file));
        setUploading(true);
        try {
            const { data } = await inventoryApi.upload(file);
            showToast(`✅ Detected ${data.count} ingredient(s)!`);
            setSuggestedPurchases(data.suggested_purchases || []);
            await load();
        } catch (err: any) {
            showToast("❌ Upload failed: " + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
            setPreview(null);
        }
    }, [showToast]);

    const handlePhotoCapture = (base64Image: string) => {
        const arr = base64Image.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], "camera-capture.jpg", { type: mime });
        setIsCameraOpen(false);
        handleFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleDelete = async (id: string) => {
        await inventoryApi.remove(id);
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const expiry = (item: Item) => {
        if (item.expiry_days === null) return "ok";
        if (item.expiry_days <= 3) return "urgent";
        if (item.expiry_days <= 7) return "soon";
        return "ok";
    };

    const filtered = items.filter(i => filterExpiry === "all" || expiry(i) === filterExpiry);

    return (
        <div>
            {isCameraOpen && <CameraCapture onCapture={handlePhotoCapture} onCancel={() => setIsCameraOpen(false)} />}
            <div className="page-header">
                <div className="page-title">🥦 Ingredient Inventory</div>
                <div className="page-subtitle">Upload photos of your fridge, pantry, or shelves — AI detects everything</div>
                <div className="page-actions">
                    {(["all", "urgent", "soon", "ok"] as const).map(f => (
                        <button key={f} className={`btn btn-sm ${filterExpiry === f ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setFilterExpiry(f)}>
                            {f === "all" ? `All (${items.length})` : f === "urgent" ? `⚡ Urgent (${items.filter(i => expiry(i) === "urgent").length})` : f === "soon" ? `⏰ Soon (${items.filter(i => expiry(i) === "soon").length})` : `✅ OK (${items.filter(i => expiry(i) === "ok").length})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Upload Zone */}
            <div className="card mb-24">
                <div
                    className={`upload-zone ${dragging ? "dragging" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onClick={() => !uploading && fileRef.current?.click()}
                >
                    {uploading ? (
                        <>
                            <div className="upload-icon">🔍</div>
                            <div className="upload-text">Analyzing your ingredients...</div>
                            {preview && <img src={preview} alt="preview" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, marginTop: 12, opacity: 0.7 }} />}
                            <div className="spinner" style={{ width: 24, height: 24, marginTop: 12 }} />
                        </>
                    ) : (
                        <>
                            <div className="upload-icon">📸</div>
                            <div className="upload-text">Drop a food photo here or click to browse</div>
                            <div className="upload-hint">Fridge • Pantry • Freezer • Counter • Shelves — any food anywhere</div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: 16 }}>
                                <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setIsCameraOpen(true); }}>
                                    📷 Take Photo
                                </button>
                                <button id="upload-btn" className="btn btn-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                                    📁 Choose Photo
                                </button>
                            </div>
                        </>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                </div>
            </div>

            {/* Suggested Purchases (post-upload feature) */}
            {suggestedPurchases.length > 0 && !loading && (
                <div style={{ marginBottom: 24, padding: "16px 20px", background: "rgba(0, 255, 128, 0.05)", borderRadius: 12, border: "1px solid rgba(0, 255, 128, 0.1)" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: "1.2rem" }}>💡</span>
                        <div style={{ fontWeight: 600, color: "var(--primary-color)" }}>Suggested to Buy</div>
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 12 }}>
                        Based on your recent scan, here are some essential missing items that complement your stock:
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {suggestedPurchases.map((sug, i) => (
                            <span key={i} style={{ background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 100, fontSize: "0.85rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                                {sug}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory Grid */}
            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🍽️</div>
                    <div className="empty-title">No ingredients yet</div>
                    <div className="empty-desc">Upload a photo of your fridge or pantry to get started!</div>
                </div>
            ) : (
                <div className="inventory-grid">
                    {filtered.map(item => {
                        const exp = expiry(item);
                        return (
                            <div key={item.id} className={`ingredient-card ${exp}`}>
                                <button id={`del-${item.id}`} className="delete-btn" onClick={() => handleDelete(item.id)}>✕</button>
                                <div className="ingredient-emoji">{item.emoji || emojis[item.category] || "🥗"}</div>
                                <div className="ingredient-name">{item.name}</div>
                                <div className="ingredient-qty">{item.quantity} {item.unit}</div>
                                <div className="ingredient-expiry">
                                    <div className={`expiry-dot ${exp}`} />
                                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                        {item.expiry_label || "Unknown expiry"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
