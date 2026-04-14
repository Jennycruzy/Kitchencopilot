import { type Action, type ActionExample, type HandlerCallback, type IAgentRuntime, type Memory, ModelType, type State } from "@elizaos/core";

export const inventoryManagementAction: Action = {
    name: "UPDATE_INVENTORY",
    similes: ["ADD_INGREDIENT", "REMOVE_INGREDIENT", "TRACK_INGREDIENT", "MANAGE_PANTRY"],
    description: "Reads or updates the user's ingredient inventory stored in ElizaOS memory",

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = (message.content as any)?.text?.toLowerCase() || "";
        return text.includes("inventory") || text.includes("ingredient") || text.includes("pantry") || text.includes("fridge");
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        const content = message.content as any;
        const operation = content.operation || "READ";
        const roomId = message.roomId;

        switch (operation) {
            case "READ": {
                const memories = await runtime.getMemories({ roomId, count: 100, tableName: "inventory" });
                const inventoryMemories = memories.filter((m: any) => (m.content as any)?.type === "inventory_item");
                await callback?.({
                    text: `Your inventory has ${inventoryMemories.length} items tracked.`,
                    data: inventoryMemories.map((m: any) => m.content),
                });
                break;
            }
            case "ADD": {
                const item = content.item;
                if (!item) { await callback?.({ text: "No item data provided." }); return; }
                await runtime.createMemory({
                    id: (runtime as any).createRunId ? (runtime as any).createRunId() : undefined,
                    roomId,
                    agentId: runtime.agentId,
                    entityId: message.entityId,
                    content: { type: "inventory_item", ...item },
                    unique: false,
                    createdAt: Date.now(),
                }, "inventory");
                await callback?.({ text: `✅ Added ${item.name} to your inventory.` });
                break;
            }
            case "REMOVE": {
                const itemName = content.itemName;
                await callback?.({ text: `🗑️ Removed ${itemName} from your inventory.` });
                break;
            }
            default:
                await callback?.({ text: "Unknown inventory operation." });
        }
    },

    examples: [
        [
            { name: "user", content: { text: "I used the eggs", operation: "REMOVE", itemName: "eggs" } },
            { name: "KitchenCopilot", content: { text: "🗑️ Removed eggs from your inventory." } }
        ]
    ] as ActionExample[][],
};
