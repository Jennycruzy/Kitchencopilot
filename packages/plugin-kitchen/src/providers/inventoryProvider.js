export const inventoryProvider = {
    name: "INVENTORY_PROVIDER",
    description: "Injects the current user's ingredient inventory into every agent context window",
    get: async (runtime, message, _state) => {
        try {
            const roomId = message.roomId;
            const memories = await runtime.getMemories({ roomId, count: 200, tableName: "inventory" });
            const inventoryItems = memories.filter((m) => m.content?.type === "inventory_item");
            if (inventoryItems.length === 0) {
                return "\n[INVENTORY]: Empty — no ingredients tracked yet. User should upload food photos.\n";
            }
            const urgent = inventoryItems.filter(m => {
                const d = m.content?.expiry_days;
                return d !== undefined && d !== null && d <= 3;
            });
            const soon = inventoryItems.filter(m => {
                const d = m.content?.expiry_days;
                return d !== undefined && d !== null && d > 3 && d <= 7;
            });
            const lines = inventoryItems.map(m => {
                const c = m.content;
                const urgency = (c.expiry_days !== null && c.expiry_days <= 3) ? "🔴 URGENT" :
                    (c.expiry_days !== null && c.expiry_days <= 7) ? "🟡 USE SOON" : "🟢";
                return `  ${urgency} ${c.name}: ${c.quantity} ${c.unit} [${c.expiry_label || "unknown expiry"}]`;
            }).join("\n");
            return `\n[INVENTORY — ${inventoryItems.length} items, ${urgent.length} urgent, ${soon.length} use soon]:\n${lines}\n`;
        }
        catch {
            return "\n[INVENTORY]: Unable to load inventory at this time.\n";
        }
    },
};
//# sourceMappingURL=inventoryProvider.js.map