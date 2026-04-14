import { type Action, type ActionExample, type HandlerCallback, type IAgentRuntime, type Memory, ModelType, type State } from "@elizaos/core";

export const recipeMatchingAction: Action = {
    name: "MATCH_RECIPES",
    similes: ["FIND_RECIPES", "SUGGEST_RECIPES", "WHAT_CAN_I_COOK", "RECIPE_SUGGESTIONS"],
    description: "Matches available inventory ingredients to recipes, prioritizing items closest to expiration",

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = (message.content as any)?.text?.toLowerCase() || "";
        return text.includes("cook") || text.includes("recipe") || text.includes("make") || text.includes("eat");
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        const content = message.content as any;
        const inventory = content.inventory || state?.data?.inventory || [];
        const profile = content.profile || state?.data?.profile || {};

        const inventoryText = Array.isArray(inventory) && inventory.length > 0
            ? inventory.map((i: any) => `${i.name}: ${i.quantity} ${i.unit} [expires: ${i.expiry_label}]`).join("\n")
            : "No inventory provided";

        const prompt = `You are KitchenCopilot. Match these ingredients to delicious recipes.

INVENTORY (sorted by expiry urgency):
${inventoryText}

PREFERENCES:
- Dietary restrictions: ${JSON.stringify(profile.dietary_restrictions || [])}
- Cuisines: ${JSON.stringify(profile.cuisine_preferences || [])}
- Skill level: ${profile.cooking_skill || "intermediate"}

Find 5 recipes that:
1. Use the most near-expiry ingredients
2. Require minimal additional shopping
3. Are practical to make given the skill level

Return ONLY JSON:
{
  "recipes": [
    {
      "name": "string",
      "cuisine": "string",
      "prep_minutes": number,
      "difficulty": "easy|medium|hard",
      "uses_expiring": ["ingredient1"],
      "ingredients_available": ["ingredient1"],
      "ingredients_needed": ["ingredient1"],
      "instructions_summary": "2-3 sentence summary",
      "waste_score": number (0-100, higher = less waste)
    }
  ]
}`;

        try {
            const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            const match = (response as string).match(/\{[\s\S]*\}/);
            const parsed = match ? JSON.parse(match[0]) : { recipes: [] };

            const topRecipe = parsed.recipes?.[0];
            const responseText = topRecipe
                ? `🍳 Top suggestion: **${topRecipe.name}** — uses your ${topRecipe.uses_expiring?.join(", ")} which are expiring soon! ${topRecipe.instructions_summary}`
                : "No matching recipes found with current inventory.";

            await callback?.({ text: responseText, data: parsed });
        } catch (err: any) {
            await callback?.({ text: `Recipe matching error: ${err.message}` });
        }
    },

    examples: [
        [
            { name: "user", content: { text: "What can I cook tonight?" } },
            { name: "KitchenCopilot", content: { text: "🍳 Top suggestion: Chicken Florentine — uses your spinach and chicken which are expiring soon!" } }
        ]
    ] as ActionExample[][],
};
