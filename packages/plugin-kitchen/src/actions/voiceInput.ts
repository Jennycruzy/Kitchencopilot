import { type Action, type ActionExample, type HandlerCallback, type IAgentRuntime, type Memory, ModelType, type State } from "@elizaos/core";

export const voiceInputAction: Action = {
    name: "PROCESS_VOICE_COMMAND",
    similes: ["VOICE_COMMAND", "SPEECH_INPUT", "SPOKEN_COMMAND", "MICROPHONE_INPUT"],
    description: "Processes transcribed voice commands from the browser microphone and routes them to the appropriate kitchen action",

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const content = message.content as any;
        return !!(content?.source === "voice" || content?.transcript || content?.isVoice);
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        const content = message.content as any;
        const transcript = content.transcript || content.text || "";

        if (!transcript.trim()) {
            await callback?.({ text: "I didn't catch that. Please try speaking again." });
            return;
        }

        const inventory = (state?.data?.inventory as any[]) || [];
        const inventorySummary = inventory.length > 0
            ? inventory.slice(0, 10).map((i: any) => `${i.name} (${i.expiry_label})`).join(", ")
            : "no inventory yet";

        // Route the voice command using ElizaOS reasoning
        const routingPrompt = `You are KitchenCopilot processing a voice command. 
Current inventory summary: ${inventorySummary}
Voice command: "${transcript}"

Identify the intent and respond conversationally (2-3 sentences, as if speaking aloud).
Also classify the action type.

Return JSON:
{
  "response": "friendly spoken response",
  "intent": "SUGGEST_MEALS|REMOVE_ITEM|ADD_SHOPPING|PLAN_MEALS|SET_BUDGET|CHECK_EXPIRY|GENERAL",
  "extracted_item": "item name or null",
  "extracted_amount": number or null,
  "confidence": number (0-1)
}`;

        try {
            const aiResponse = await runtime.useModel(ModelType.TEXT_SMALL, { prompt: routingPrompt });
            const match = (aiResponse as string).match(/\{[\s\S]*\}/);

            if (match) {
                const parsed = JSON.parse(match[0]);
                await callback?.({
                    text: parsed.response,
                    data: {
                        intent: parsed.intent,
                        extracted_item: parsed.extracted_item,
                        extracted_amount: parsed.extracted_amount,
                        transcript,
                    },
                });
            } else {
                await callback?.({ text: aiResponse as string });
            }
        } catch (err: any) {
            await callback?.({ text: `I heard "${transcript}" but had trouble processing it. Could you try again?` });
        }
    },

    examples: [
        [
            { name: "user", content: { text: "what can I cook today", source: "voice", transcript: "what can I cook today" } },
            { name: "KitchenCopilot", content: { text: "Looking at your inventory, I'd suggest making a stir-fry tonight! Your vegetables are expiring in 2 days and would be perfect with the chicken you have." } }
        ],
        [
            { name: "user", content: { text: "I used the eggs", source: "voice", transcript: "I used the eggs" } },
            { name: "KitchenCopilot", content: { text: "Got it! Removing eggs from your inventory now. Your meal plan has been updated to use alternative breakfast options." } }
        ]
    ] as ActionExample[][],
};
