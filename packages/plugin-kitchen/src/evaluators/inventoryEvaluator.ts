import { type Evaluator, type IAgentRuntime, type Memory, type State } from "@elizaos/core";

export const inventoryEvaluator: Evaluator = {
    name: "INVENTORY_EVALUATOR",
    similes: ["TRACK_USAGE", "DEDUCT_INGREDIENTS"],
    description: "Post-turn evaluator: detects when the agent's response indicates an ingredient was used and deducts it from inventory",

    validate: async (_runtime: IAgentRuntime, _message: Memory): Promise<boolean> => {
        return true; // Run after every turn
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<void> => {
        const text = (message.content as any)?.text?.toLowerCase() || "";

        // Detect ingredient usage patterns
        const usagePatterns = [
            /i (?:used|cooked|made|ate|finished|consumed) (?:the |my )?(.+)/i,
            /(?:remove|removing|used up|ran out of) (?:the )?(.+)/i,
            /(?:no more|out of) (.+)/i,
        ];

        let detectedItem: string | null = null;
        for (const pattern of usagePatterns) {
            const match = text.match(pattern);
            if (match) {
                detectedItem = match[1].replace(/\.$/, "").trim();
                break;
            }
        }

        if (!detectedItem) return;

        // Note the usage in memory for future context
        try {
            await runtime.createMemory({
                id: (runtime as any).createRunId ? (runtime as any).createRunId() : undefined,
                roomId: message.roomId,
                agentId: runtime.agentId,
                entityId: runtime.agentId,
                content: {
                    type: "ingredient_used",
                    item: detectedItem,
                    timestamp: Date.now(),
                    turn_text: text.slice(0, 100),
                },
                unique: false,
                createdAt: Date.now()
            }, "messages");

            console.log(`[InventoryEvaluator] Logged usage of: ${detectedItem}`);
        } catch (err) {
            console.error("[InventoryEvaluator] Error logging usage:", err);
        }
    },

    examples: [],
};
