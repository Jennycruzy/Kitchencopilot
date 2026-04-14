import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryApi, mealPlanApi } from "../api/client";
import { useAuth } from "../App";

interface InventoryItem { id: string; name: string; quantity: string; unit: string; expiry_label: string; expiry_days: number | null; category: string; }
interface MealPlan { plan_data: any; }

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([inventoryApi.list(), mealPlanApi.get()])
            .then(([invRes, planRes]) => {
                setInventory(invRes.data || []);
                setMealPlan(planRes.data?.plan_data ? planRes.data : null);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const urgent = inventory.filter(i => i.expiry_days !== null && i.expiry_days <= 3);
    const usingSoon = inventory.filter(i => i.expiry_days !== null && i.expiry_days > 3 && i.expiry_days <= 7);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const todayMeals = mealPlan?.plan_data?.days?.find((d: any) => d.day === today);

    const categoryEmojis: Record<string, string> = {
        produce: "🥦", dairy: "🧀", protein: "🥩", pantry: "🫙", frozen: "🧊",
        condiment: "🫙", beverage: "🧃", other: "📦"
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div className="page-title">
                    Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.displayName || user?.username}! 👋
                </div>
                <div className="page-subtitle">Here's your kitchen overview for today</div>
            </div>

            {/* Stat Cards */}
            <div className="stat-grid">
                <div className="stat-card green">
                    <div className="stat-icon">🥦</div>
                    <div className="stat-value" style={{ color: "var(--accent-green)" }}>{inventory.length}</div>
                    <div className="stat-label">Total Ingredients</div>
                </div>
                <div className="stat-card red">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-value" style={{ color: "var(--accent-red)" }}>{urgent.length}</div>
                    <div className="stat-label">Expiring in 3 Days</div>
                </div>
                <div className="stat-card amber">
                    <div className="stat-icon">⏰</div>
                    <div className="stat-value" style={{ color: "var(--accent-amber)" }}>{usingSoon.length}</div>
                    <div className="stat-label">Use Within a Week</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon">📜</div>
                    <div className="stat-value" style={{ color: "var(--accent-blue)" }}>
                        {mealPlan ? <span style={{ fontSize: 16 }}>Active</span> : <span style={{ fontSize: 16 }}>None</span>}
                    </div>
                    <div className="stat-label">Meal Plan</div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                {/* Today's Meals */}
                <div className="card">
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>
                        Today's Meals — {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </h2>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate("/mealplan")}>Full Plan</button>
                    {todayMeals ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(["breakfast", "lunch", "dinner"] as const).map(mealType => {
                                const meal = todayMeals.meals?.[mealType];
                                if (!meal) return null;
                                return (
                                    <div key={mealType} className="meal-card">
                                        <div className="meal-type">{mealType}</div>
                                        <div className="meal-name">{meal.name}</div>
                                        <div className="meal-meta">⏱ {meal.prep_minutes || "?"} min · {meal.calories_est || "?"} cal</div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: "24px 0" }}>
                            <div className="empty-icon">🥘</div>
                            <div className="empty-desc">No meal plan yet</div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate("/mealplan")}>
                                Generate Plan
                            </button>
                        </div>
                    )}
                </div>

                {/* Expiring Soon */}
                <div className="card">
                    <div className="flex justify-between items-center mb-16">
                        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>⚡ Use First!</h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/inventory")}>All Items</button>
                    </div>
                    {urgent.length === 0 && usingSoon.length === 0 ? (
                        <div className="empty-state" style={{ padding: "24px 0" }}>
                            <div className="empty-icon">✅</div>
                            <div className="empty-desc">Nothing expiring soon — great job!</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[...urgent, ...usingSoon].slice(0, 6).map(item => (
                                <div key={item.id} className="flex items-center gap-12" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                                    <span style={{ fontSize: 20 }}>{categoryEmojis[item.category] || "🥗"}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.quantity} {item.unit}</div>
                                    </div>
                                    <span className={`badge ${item.expiry_days !== null && item.expiry_days <= 3 ? "badge-red" : "badge-amber"}`}>
                                        {item.expiry_label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
