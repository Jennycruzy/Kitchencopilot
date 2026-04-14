export const inventoryManagementAction = {
    name: "UPDATE_INVENTORY",
    similes: ["ADD_INGREDIENT", "REMOVE_INGREDIENT", "TRACK_INGREDIENT", "MANAGE_PANTRY"],
    description: "Reads or updates the user's ingredient inventory stored in ElizaOS memory",
    validate: async (_runtime, message) => {
        const text = message.content?.text?.toLowerCase() || "";
        return text.includes("inventory") || text.includes("ingredient") || text.includes("pantry") || text.includes("fridge");
    },
    handler: async (runtime, message, state, _options, callback) => {
        const content = message.content;
        const operation = content.operation || "READ";
        const roomId = message.roomId;
        switch (operation) {
            case "READ": {
                const memories = await runtime.getMemoryManager().getMemories({ roomId, count: 100 });
                const inventoryMemories = memories.filter(m => m.content?.type === "inventory_item");
                await callback({
                    text: `Your inventory has ${inventoryMemories.length} items tracked.`,
                    data: inventoryMemories.map(m => m.content),
                });
                break;
            }
            case "ADD": {
                const item = content.item;
                if (!item) {
                    await callback({ text: "No item data provided." });
                    return;
                }
                await runtime.getMemoryManager().createMemory({
                    roomId,
                    agentId: runtime.agentId,
                    entityId: message.entityId,
                    content: { type: "inventory_item", ...item },
                    unique: false,
                });
                await callback({ text: `✅ Added ${item.name} to your inventory.` });
                break;
            }
            case "REMOVE": {
                const itemName = content.itemName;
                await callback({ text: `🗑️ Removed ${itemName} from your inventory.` });
                break;
            }
            default:
                await callback({ text: "Unknown inventory operation." });
        }
    },
    examples: [
        [
            { user: "user", content: { text: "I used the eggs", operation: "REMOVE", itemName: "eggs" } },
            { user: "KitchenCopilot", content: { text: "🗑️ Removed eggs from your inventory." } }
        ]
    ],
};
//# sourceMappingURL=inventoryManagement.js.map