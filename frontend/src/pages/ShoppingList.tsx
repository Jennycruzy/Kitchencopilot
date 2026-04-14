import React, { useEffect, useState } from "react";
import { shoppingApi, budgetApi } from "../api/client";
import { useToast } from "../App";

interface ShoppingItem { name: string; estimated_cost: number | null; unit?: string; store_section?: string; checked: boolean; }

export default function ShoppingList() {
    const [items, setItems] = useState<ShoppingItem[]>([]);
    const [total, setTotal] = useState(0);
    const [budget, setBudget] = useState(0);
    const [newBudget, setNewBudget] = useState("");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const { showToast } = useToast();

    const load = async () => {
        try {
            const [listRes, budgetRes] = await Promise.all([shoppingApi.get(), budgetApi.get()]);
            setItems((listRes.data.items || []).map((i: any) => ({ ...i, checked: false })));
            setTotal(listRes.data.estimated_total || 0);
            setBudget(listRes.data.budget || budgetRes.data.weekly_budget || 0);
            setMessage(listRes.data.message || "");
        } catch (err: any) {
            setMessage(err.response?.data?.error || "Generate a meal plan first to create a shopping list");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleCheck = (index: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item));
    };

    const saveBudget = async () => {
        const val = parseFloat(newBudget);
        if (isNaN(val) || val < 0) { showToast("Please enter a valid budget"); return; }
        await budgetApi.set(val);
        setBudget(val);
        setNewBudget("");
        showToast(`💰 Budget set to $${val}/week`);
    };

    const checkedCount = items.filter(i => i.checked).length;
    const uncheckedTotal = items.filter(i => !i.checked).reduce((s, i) => s + (i.estimated_cost || 0), 0);
    const pct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
    const overBudget = budget > 0 && total > budget;
    const radius = 70;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (pct / 100) * circ;

    const sectionColors: Record<string, string> = {
        produce: "🥦", dairy: "🧀", meat: "🥩", pantry: "🫙", frozen: "🧊", other: "📦"
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-title">🛒 Shopping List</div>
                <div className="page-subtitle">Items needed for your meal plan that aren't in your inventory</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>

                {/* List */}
                <div>
                    {loading ? (
                        <div className="loading-center"><div className="spinner" /></div>
                    ) : items.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">🎉</div>
                            <div className="empty-title">No shopping needed!</div>
                            <div className="empty-desc">{message || "Your inventory covers your meal plan. Great job!"}</div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-16">
                                <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                                    {checkedCount}/{items.length} items checked · ${uncheckedTotal.toFixed(2)} remaining
                                </span>
                                <button className="btn btn-ghost btn-sm" onClick={() =>
                                    setItems(prev => prev.map(i => ({ ...i, checked: !prev.every(x => x.checked) })))}>
                                    {items.every(i => i.checked) ? "Uncheck All" : "Check All"}
                                </button>
                            </div>

                            {items.map((item, idx) => (
                                <div key={idx} id={`shop-item-${idx}`} className={`shopping-item ${item.checked ? "checked" : ""}`}>
                                    <div className={`shopping-check ${item.checked ? "checked" : ""}`}
                                        onClick={() => toggleCheck(idx)}>
                                        {item.checked && <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>✓</span>}
                                    </div>
                                    <span style={{ fontSize: 18 }}>{sectionColors[item.store_section || "other"] || "📦"}</span>
                                    <div style={{ flex: 1 }}>
                                        <div className="shopping-name">{item.name}</div>
                                        {item.unit && <div className="shopping-section">{item.unit} · {item.store_section || "General"}</div>}
                                    </div>
                                    {item.estimated_cost !== null && (
                                        <div className="shopping-cost">${item.estimated_cost.toFixed(2)}</div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Budget Panel */}
                <div>
                    <div className="card mb-16">
                        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                            💰 Budget Tracker
                        </h3>

                        {budget > 0 ? (
                            <>
                                <div className="budget-ring">
                                    <svg width="160" height="160" viewBox="0 0 160 160">
                                        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
                                        <circle
                                            cx="80" cy="80" r={radius}
                                            fill="none"
                                            stroke={overBudget ? "var(--accent-red)" : "var(--accent-green)"}
                                            strokeWidth="12"
                                            strokeDasharray={circ}
                                            strokeDashoffset={offset}
                                            strokeLinecap="round"
                                            style={{ transition: "stroke-dashoffset 1s ease" }}
                                        />
                                    </svg>
                                    <div className="budget-ring-text">
                                        <div className="budget-pct" style={{ color: overBudget ? "var(--accent-red)" : "var(--accent-green)" }}>
                                            {Math.round(pct)}%
                                        </div>
                                        <div className="budget-label">of budget</div>
                                    </div>
                                </div>

                                <div style={{ textAlign: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                                        ${total.toFixed(2)}
                                        <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 400 }}> / ${budget}</span>
                                    </div>
                                    <div className={`badge ${overBudget ? "badge-red" : "badge-green"}`} style={{ marginTop: 8 }}>
                                        {overBudget ? `⚠️ $${(total - budget).toFixed(2)} over budget` : `✅ $${(budget - total).toFixed(2)} under budget`}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="empty-state" style={{ padding: "16px 0" }}>
                                <div className="empty-icon" style={{ fontSize: 32 }}>💰</div>
                                <div className="empty-desc">No budget set — add one below</div>
                            </div>
                        )}

                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">Set Weekly Budget ($)</label>
                            <div className="flex gap-8">
                                <input id="budget-input" type="number" className="form-input" placeholder="50.00" min="0" step="0.01"
                                    value={newBudget} onChange={e => setNewBudget(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && saveBudget()} />
                                <button id="budget-save-btn" className="btn btn-primary btn-sm" onClick={saveBudget} style={{ whiteSpace: "nowrap" }}>
                                    Set
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                            🏪 By Section
                        </h3>
                        {["produce", "dairy", "meat", "pantry", "frozen", "other"].map(section => {
                            const sectionItems = items.filter(i => (i.store_section || "other") === section);
                            if (sectionItems.length === 0) return null;
                            const sectionTotal = sectionItems.reduce((s, i) => s + (i.estimated_cost || 0), 0);
                            return (
                                <div key={section} className="flex justify-between items-center" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                                    <span>{sectionColors[section] || "📦"} {section}</span>
                                    <span style={{ color: "var(--text-secondary)" }}>{sectionItems.length} · ${sectionTotal.toFixed(2)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
