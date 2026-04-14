import { type Action, type ActionExample, type HandlerCallback, type IAgentRuntime, type Memory, ModelType, type State } from "@elizaos/core";

export const budgetPlanningAction: Action = {
    name: "PLAN_BUDGET",
    similes: ["SET_BUDGET", "BUDGET_OPTIMIZATION", "COST_ESTIMATE", "GROCERY_BUDGET"],
    description: "Sets and tracks food budget; optimizes meal plans and shopping lists to stay within budget constraints",

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = (message.content as any)?.text?.toLowerCase() || "";
        return text.includes("budget") || text.includes("cost") || text.includes("spend") || text.includes("money") || text.includes("afford") || text.includes("$");
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        const content = message.content as any;
        const text = content.text || "";
        const budget = content.budget || 0;
        const currentSpend = content.estimated_spend || 0;

        // Extract budget amount from text if not provided directly
        let extractedBudget = budget;
        if (!budget && text) {
            const dollarMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
            const numberMatch = text.match(/(\d+(?:\.\d{2})?)\s*(?:dollars?|bucks?)/i);
            if (dollarMatch) extractedBudget = parseFloat(dollarMatch[1]);
            else if (numberMatch) extractedBudget = parseFloat(numberMatch[1]);
        }

        if (extractedBudget > 0) {
            const prompt = `As KitchenCopilot, confirm the user set a weekly food budget of $${extractedBudget}.
Give a warm 1-2 sentence confirmation and a helpful tip about maximizing their budget.`;

            const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            await callback?.({
                text: response as string,
                data: { budget_set: extractedBudget, action: "SET_BUDGET" },
            });
        } else if (currentSpend > 0) {
            const diff = currentSpend - budget;
            const within = diff <= 0;
            await callback?.({
                text: within
                    ? `✅ You're within budget! Spending $${currentSpend.toFixed(2)} of your $${budget} weekly budget. You'll save $${Math.abs(diff).toFixed(2)}!`
                    : `⚠️ Your current plan is $${diff.toFixed(2)} over budget. I'll suggest cheaper alternatives to bring it under $${budget}.`,
                data: { budget, estimated_spend: currentSpend, within_budget: within, difference: diff },
            });
        } else {
            await callback?.({ text: `💰 You can set a weekly food budget anytime! Just say "Set my budget to $50" and I'll optimize everything around it.` });
        }
    },

    examples: [
        [
            { name: "user", content: { text: "Set my budget to $75 per week" } },
            { name: "KitchenCopilot", content: { text: "✅ Budget set to $75/week! I'll prioritize your existing inventory and only add the most cost-effective items to your shopping list." } }
        ]
    ] as ActionExample[][],
};
