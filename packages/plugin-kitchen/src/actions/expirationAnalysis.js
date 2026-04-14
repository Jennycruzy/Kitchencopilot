import { ModelType } from "@elizaos/core";
export const expirationAnalysisAction = {
    name: "ANALYZE_EXPIRATION",
    similes: ["CHECK_EXPIRY", "EXPIRATION_CHECK", "USE_SOON", "FRESHNESS_CHECK"],
    description: "Analyzes inventory items for expiration urgency and provides prioritized 'use soon' recommendations",
    validate: async (_runtime, message) => {
        const text = message.content?.text?.toLowerCase() || "";
        return text.includes("expir") || text.includes("fresh") || text.includes("use soon") || text.includes("spoil") || text.includes("old");
    },
    handler: async (runtime, message, state, _options, callback) => {
        const content = message.content;
        const inventory = content.inventory || state?.data?.inventory || [];
        // Classify items by expiry urgency
        const urgent = inventory.filter((i) => i.expiry_days !== null && i.expiry_days <= 3);
        const soon = inventory.filter((i) => i.expiry_days !== null && i.expiry_days > 3 && i.expiry_days <= 7);
        const ok = inventory.filter((i) => i.expiry_days === null || i.expiry_days > 7);
        if (inventory.length === 0) {
            await callback({ text: "No inventory found. Upload some ingredient photos first!" });
            return;
        }
        // Use LLM to generate smart advice
        const prompt = `As KitchenCopilot, give friendly advice about these expiring ingredients:

URGENT (1-3 days): ${urgent.map((i) => i.name).join(", ") || "none"}
USE SOON (4-7 days): ${soon.map((i) => i.name).join(", ") || "none"}
GOOD (7+ days): ${ok.map((i) => i.name).join(", ") || "none"}

Give 2-3 sentences of warm, actionable advice. Suggest what to cook first.`;
        try {
            const advice = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            await callback({
                text: advice,
                data: {
                    urgent: urgent.map((i) => ({ name: i.name, expiry_days: i.expiry_days })),
                    soon: soon.map((i) => ({ name: i.name, expiry_days: i.expiry_days })),
                    ok_count: ok.length,
                },
            });
        }
        catch (err) {
            await callback({
                text: `⚡ ${urgent.length} items expiring within 3 days: ${urgent.map((i) => i.name).join(", ")}. Use these first!`,
                data: { urgent, soon, ok_count: ok.length },
            });
        }
    },
    examples: [
        [
            { user: "user", content: { text: "What's about to expire?" } },
            { user: "KitchenCopilot", content: { text: "⚡ Your spinach and chicken expire in 2 days. Tonight's dinner should use both — a Chicken Florentine would be perfect!" } }
        ]
    ],
};
//# sourceMappingURL=expirationAnalysis.js.map