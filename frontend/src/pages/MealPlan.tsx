import React, { useEffect, useState } from "react";
import { mealPlanApi, inventoryApi } from "../api/client";
import { useToast } from "../App";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };

export default function MealPlan() {
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [invNames, setInvNames] = useState<string[]>([]);
    const [selectedInventories, setSelectedInventories] = useState<string[]>([]);
    const { showToast } = useToast();
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

    useEffect(() => {
        mealPlanApi.get()
            .then(r => setPlan(r.data?.plan_data || null))
            .catch(console.error)
            .finally(() => setLoading(false));

        inventoryApi.list().then(r => {
            const items = r.data || [];
            setInvNames(Array.from(new Set(items.map((i: any) => i.inventory_name || "Main"))) as string[]);
        }).catch(() => { });
    }, []);

    const generate = async () => {
        setGenerating(true);
        try {
            const { data } = await mealPlanApi.generate(selectedInventories.length > 0 ? selectedInventories : undefined);
            setPlan(data.plan_data);
            showToast("✅ 7-day meal plan generated!");
        } catch (err: any) {
            showToast("❌ " + (err.response?.data?.error || "Generation failed"));
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-title">📜 Weekly Plans ({new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})</div>
                <div className="page-subtitle">AI-generated plan using your inventory — expiring items used first</div>
                <div className="page-actions">
                    <button id="generate-plan-btn" className="btn btn-primary" onClick={generate} disabled={generating}>
                        {generating ? "⏳ Generating..." : "🔄 Generate This Week"}
                    </button>
                    {plan?.efficiency_score && (
                        <div className="card" style={{ padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "var(--accent-green)", fontWeight: 700 }}>{plan.efficiency_score}%</span>
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Inventory Used</span>
                        </div>
                    )}
                    {plan?.expiring_used?.length > 0 && (
                        <div className="badge badge-amber" style={{ padding: "8px 14px", fontSize: 12 }}>
                            ⚡ {plan.expiring_used.length} expiring items prioritized
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: 24, padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Target Inventories (leave empty to use all)</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {invNames.map(name => (
                        <label key={name} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                            <input type="checkbox"
                                checked={selectedInventories.includes(name)}
                                onChange={e => {
                                    if (e.target.checked) setSelectedInventories([...selectedInventories, name]);
                                    else setSelectedInventories(selectedInventories.filter(x => x !== name));
                                }}
                            />
                            {name}
                        </label>
                    ))}
                    {invNames.length === 0 && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No items in inventory.</span>}
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : !plan ? (
                <div className="empty-state">
                    <div className="empty-icon">🥘</div>
                    <div className="empty-title">No meal plan yet</div>
                    <div className="empty-desc">Upload some ingredient photos first, then generate your plan!</div>
                    <button id="gen-btn-empty" className="btn btn-primary" style={{ marginTop: 20 }} onClick={generate} disabled={generating}>
                        {generating ? "⏳ Generating..." : "🚀 Generate Meal Plan"}
                    </button>
                </div>
            ) : (
                <div className="meal-grid">
                    {DAYS.map(day => {
                        const dayData = plan.days?.find((d: any) => d.day === day);
                        const isToday = day === today;
                        return (
                            <div key={day} className="day-column">
                                <div className={`day-header ${isToday ? "today" : ""}`}>
                                    {isToday ? "📍 " : ""}{day.slice(0, 3)}
                                </div>
                                {MEAL_TYPES.map(mealType => {
                                    const meal = dayData?.meals?.[mealType];
                                    return (
                                        <div key={mealType} className="meal-card" title={meal?.ingredients_used?.join(", ") || ""}>
                                            <div className="meal-type">{MEAL_ICONS[mealType]} {mealType}</div>
                                            {meal ? (
                                                <>
                                                    <div className="meal-name">{meal.name}</div>
                                                    <div className="meal-meta">
                                                        {meal.prep_minutes && `⏱ ${meal.prep_minutes}m`}
                                                        {meal.needs_shopping?.length > 0 && (
                                                            <span style={{ color: "var(--accent-amber)", marginLeft: 4 }}>
                                                                🛒 {meal.needs_shopping.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>—</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
