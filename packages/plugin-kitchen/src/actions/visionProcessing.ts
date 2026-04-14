import { type Action, type ActionExample, type HandlerCallback, type IAgentRuntime, type Memory, ModelType, type State } from "@elizaos/core";

export const visionProcessingAction: Action = {
    name: "EXTRACT_INGREDIENTS",
    similes: ["ANALYZE_FOOD_IMAGE", "SCAN_INGREDIENTS", "DETECT_FOOD", "PROCESS_IMAGE"],
    description: "Analyzes an uploaded food/kitchen image using ElizaOS vision to extract ingredient names, quantities, and expiry estimates",

    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const content = message.content as any;
        return !!(content?.imageBase64 || content?.imageUrl || content?.attachments?.length);
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        const content = message.content as any;
        const imageData = content.imageBase64 || content.imageUrl;

        if (!imageData) {
            await callback?.({ text: "No image data provided. Please upload a food photo." });
            return;
        }

        const prompt = `Analyze this kitchen/food image and identify all visible food items.
For each item provide: name, quantity estimate, unit, category, and estimated days until expiry.
Categories: produce, dairy, protein, pantry, frozen, condiment, beverage, other
Return ONLY valid JSON: {"ingredients":[{"name":"","quantity":"","unit":"","category":"","expiry_days":0,"expiry_label":""}],"scene_description":""}`;

        try {
            const result = await runtime.useModel(ModelType.IMAGE_DESCRIPTION, {
                imageUrl: imageData,
                prompt,
            });

            const match = (result as unknown as string).match(/\{[\s\S]*\}/);
            const parsed = match ? JSON.parse(match[0]) : { ingredients: [], scene_description: "Could not parse" };

            await callback?.({
                text: `✅ Found ${parsed.ingredients.length} ingredient(s): ${parsed.ingredients.map((i: any) => i.name).join(", ")}`,
                data: parsed,
            });
        } catch (err: any) {
            await callback?.({ text: `Vision analysis error: ${err.message}` });
        }
    },

    examples: [
        [
            { name: "user", content: { text: "Here's a photo of my fridge", imageUrl: "data:image/jpeg;base64,..." } },
            { name: "KitchenCopilot", content: { text: "✅ Found 8 ingredients: eggs, milk, spinach, chicken breast, cheddar cheese, carrots, yogurt, butter" } }
        ]
    ] as ActionExample[][],
};
