import React, { useCallback, useEffect, useRef, useState } from "react";
import { inventoryApi } from "../api/client";
import { useToast } from "../App";
import { CameraCapture } from "../components/CameraCapture";

interface Item { id: string; name: string; quantity: string; unit: string; category: string; emoji?: string; expiry_label: string; expiry_days: number | null; inventory_name?: string; }

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
    const [pendingItems, setPendingItems] = useState<Item[]>([]);
    const [saveDestination, setSaveDestination] = useState("Main");
    const [newDestination, setNewDestination] = useState("");
    const [clearExisting, setClearExisting] = useState(false);
    const [filterExpiry, setFilterExpiry] = useState<"all" | "urgent" | "soon" | "ok">("all");
    const fileRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);
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
            setPendingItems(data.detected || []);
            setSaveDestination("Main");
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

    const handleClearSection = async (invName: string) => {
        if (!window.confirm(`Are you sure you want to clear ${invName}?`)) return;
        setLoading(true);
        await inventoryApi.clear(invName);
        await load();
    };

    const filtered = items.filter(i => filterExpiry === "all" || expiry(i) === filterExpiry);

    const groupedItems = filtered.reduce((acc, item) => {
        const key = item.inventory_name || "Main";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, Item[]>);

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
                                <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }}>
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
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
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

            {/* Inventory Grouped Rendering */}
            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🍽️</div>
                    <div className="empty-title">No ingredients yet</div>
                    <div className="empty-desc">Upload a photo of your fridge or pantry to get started!</div>
                </div>
            ) : (
                <div className="inventory-groups" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {Object.entries(groupedItems).map(([invName, invItems]) => (
                        <div key={invName} className="inventory-group">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
                                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span>📍</span> {invName}
                                </h3>
                                <button className="btn btn-sm" style={{ background: "rgba(255,50,50,0.1)", color: "#ff6b6b" }} onClick={() => handleClearSection(invName)}>
                                    Clear Section
                                </button>
                            </div>
                            <div className="inventory-grid">
                                {invItems.map(item => {
                                    const exp = expiry(item);
                                    return (
                                        <div key={item.id} className={`ingredient-card ${exp}`}>
                                            <button id={`del-${item.id}`} className="delete-btn" onClick={() => handleDelete(item.id)}>✕</button>
                                            <div className="ingredient-emoji">{item.emoji && item.emoji !== '🥗' ? item.emoji : (emojis[item.category] || "🥗")}</div>
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
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Items Modal Overlay */}
            {pendingItems.length > 0 && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: 24, borderRadius: 16, maxWidth: 500, width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.4rem' }}>🌟 New Ingredients Detected!</h3>
                        <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)' }}>Where would you like to save these {pendingItems.length} items?</p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                            <select
                                className="input-field"
                                style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                value={saveDestination}
                                onChange={e => setSaveDestination(e.target.value)}
                            >
                                {Array.from(new Set(items.map(i => i.inventory_name || "Main"))).map(inv => (
                                    <option key={inv} value={inv}>{inv}</option>
                                ))}
                                <option value="_NEW_">-- Create New Section --</option>
                            </select>

                            {saveDestination === "_NEW_" && (
                                <input
                                    type="text"
                                    placeholder="E.g., Second Fridge"
                                    style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                    value={newDestination}
                                    onChange={e => setNewDestination(e.target.value)}
                                />
                            )}

                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", padding: "12px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 8, cursor: "pointer" }}>
                                <input type="checkbox" style={{ transform: "scale(1.2)" }} checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} />
                                Wipe existing items in this section before saving
                            </label>
                        </div>

                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary" onClick={() => setPendingItems([])}>Cancel</button>
                            <button className="btn btn-primary" onClick={async () => {
                                const targetName = saveDestination === "_NEW_" ? newDestination : saveDestination;
                                if (!targetName.trim()) return showToast("Enter a section name!");

                                setLoading(true);
                                await inventoryApi.bulkSave({
                                    items: pendingItems,
                                    inventory_name: targetName,
                                    clear_existing: clearExisting
                                });
                                setPendingItems([]);
                                showToast(`✅ Saved to ${targetName}!`);
                                load();
                            }}>Save to {saveDestination === "_NEW_" ? (newDestination || "...") : saveDestination}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
