import { type IAgentRuntime, type Memory, type Provider, type State } from "@elizaos/core";

export const userContextProvider: Provider = {
    name: "USER_CONTEXT_PROVIDER",
    description: "Injects authenticated user profile (dietary restrictions, cuisine preferences, budget, skill level) into every agent context",

    get: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<any> => {
        try {
            const roomId = message.roomId;

            // Fetch user profile from memory
            const memories = await runtime.getMemories({ roomId, count: 10, tableName: "profiles" });
            const profileMemory = memories.find((m: any) => (m.content as any)?.type === "user_profile");

            if (!profileMemory) {
                return "\n[USER PROFILE]: New user — no preferences set yet. Defaults: no restrictions, any cuisine, intermediate skill, no budget limit.\n";
            }

            const p = profileMemory.content as any;
            const restrictions = Array.isArray(p.dietary_restrictions) && p.dietary_restrictions.length
                ? p.dietary_restrictions.join(", ")
                : "None";
            const cuisines = Array.isArray(p.cuisine_preferences) && p.cuisine_preferences.length
                ? p.cuisine_preferences.join(", ")
                : "Any";

            return `\n[USER PROFILE]:
  - Household size: ${p.household_size || 1} person(s)
  - Dietary restrictions: ${restrictions}
  - Cuisine preferences: ${cuisines}
  - Cooking skill: ${p.cooking_skill || "intermediate"}
  - Weekly budget: ${p.weekly_budget > 0 ? "$" + p.weekly_budget : "not set"}\n`;
        } catch {
            return "\n[USER PROFILE]: Unable to load profile at this time.\n";
        }
    },
};
