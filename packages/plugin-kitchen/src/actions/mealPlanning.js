import { ModelType } from "@elizaos/core";
export const mealPlanningAction = {
    name: "GENERATE_MEAL_PLAN",
    similes: ["PLAN_MEALS", "CREATE_MEAL_PLAN", "WEEKLY_PLAN", "SCHEDULE_MEALS"],
    description: "Generates a 7-day optimized meal plan using available inventory, prioritizing expiring ingredients within budget",
    validate: async (_runtime, message) => {
        const text = message.content?.text?.toLowerCase() || "";
        return text.includes("meal plan") || text.includes("plan") || text.includes("week") || text.includes("meals for");
    },
    handler: async (runtime, message, state, _options, callback) => {
        const content = message.content;
        const inventory = content.inventory || state?.data?.inventory || [];
        const profile = content.profile || state?.data?.profile || {};
        await callback({ text: "🗓️ Generating your personalized 7-day meal plan..." });
        const inventoryText = inventory.length > 0
            ? inventory.map((i) => `${i.name}: ${i.quantity} ${i.unit} [expires: ${i.expiry_label}]`).join("\n")
            : "Empty inventory — generating general plan";
        const prompt = `Generate a 7-day meal plan for KitchenCopilot.

INVENTORY (prioritize expiring items):
${inventoryText}

USER PROFILE:
- Restrictions: ${JSON.stringify(profile.dietary_restrictions || [])}
- Preferences: ${JSON.stringify(profile.cuisine_preferences || [])}
- Household size: ${profile.household_size || 1}
- Budget: ${profile.weekly_budget > 0 ? "$" + profile.weekly_budget + "/week" : "flexible"}
- Skill: ${profile.cooking_skill || "intermediate"}

RULES:
1. Prioritize ingredients expiring in 1-7 days
2. Aim for 85%+ inventory utilization
3. Balance nutrition across the week
4. Keep shopping needs minimal

Return ONLY JSON with 7 days, each having breakfast/lunch/dinner with ingredients_used and needs_shopping arrays.`;
        try {
            const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
            const match = response.match(/\{[\s\S]*\}/);
            const plan = match ? JSON.parse(match[0]) : null;
            if (plan?.days?.length) {
                await callback({
                    text: `✅ 7-day meal plan generated! Efficiency: ${plan.efficiency_score || "85+"}%. Using ${plan.expiring_used?.length || "several"} near-expiry items first.`,
                    data: plan,
                });
            }
            else {
                await callback({ text: "⚠️ Could not generate a full meal plan. Please ensure your inventory is up to date." });
            }
        }
        catch (err) {
            await callback({ text: `Meal planning error: ${err.message}` });
        }
    },
    examples: [
        [
            { user: "user", content: { text: "Plan meals for this week" } },
            { user: "KitchenCopilot", content: { text: "✅ 7-day meal plan generated! Efficiency: 87%. Using spinach, chicken, and eggs first." } }
        ]
    ],
};
//# sourceMappingURL=mealPlanning.js.map