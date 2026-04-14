import { ModelType } from "@elizaos/core";
export const shoppingListAction = {
    name: "GENERATE_SHOPPING_LIST",
    similes: ["CREATE_SHOPPING_LIST", "WHAT_TO_BUY", "GROCERY_LIST", "SHOPPING"],
    description: "Generates a targeted shopping list for missing ingredients needed for the meal plan, with estimated costs",
    validate: async (_runtime, message) => {
        const text = message.content?.text?.toLowerCase() || "";
        return text.includes("shopping") || text.includes("grocery") || text.includes("buy") || text.includes("store");
    },
    handler: async (runtime, message, state, _options, callback) => {
        const content = message.content;
        const needed = content.needed || [];
        const budget = content.budget || 0;
        if (needed.length === 0) {
            await callback({ text: "🎉 Great news! Your inventory covers everything in your meal plan. No shopping needed this week!" });
            return;
        }
        const prompt = `Estimate US grocery prices for these items. Return ONLY a JSON array:
Items: ${needed.join(", ")}

[{"name":"item","estimated_cost":1.99,"unit":"each/lb/bag","store_section":"produce/dairy/meat/pantry/frozen"}]`;
        try {
            const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            const match = response.match(/\[[\s\S]*\]/);
            const items = match ? JSON.parse(match[0]) : needed.map((n) => ({ name: n, estimated_cost: 0 }));
            const total = items.reduce((s, i) => s + (i.estimated_cost || 0), 0);
            const budgetNote = budget > 0
                ? total <= budget
                    ? `✅ Within your $${budget} budget (estimated $${total.toFixed(2)})`
                    : `⚠️ Over budget by $${(total - budget).toFixed(2)} — consider removing some items`
                : `Estimated total: $${total.toFixed(2)}`;
            await callback({
                text: `🛒 Shopping list ready! ${items.length} items needed. ${budgetNote}`,
                data: { items, estimated_total: total, budget },
            });
        }
        catch (err) {
            await callback({ text: `Shopping list error: ${err.message}` });
        }
    },
    examples: [
        [
            { user: "user", content: { text: "Add milk to my shopping list" } },
            { user: "KitchenCopilot", content: { text: "🛒 Added milk to your shopping list! Estimated cost: $3.49" } }
        ]
    ],
};
//# sourceMappingURL=shoppingList.js.map