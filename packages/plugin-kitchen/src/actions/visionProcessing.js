import { ModelType } from "@elizaos/core";
export const visionProcessingAction = {
    name: "EXTRACT_INGREDIENTS",
    similes: ["ANALYZE_FOOD_IMAGE", "SCAN_INGREDIENTS", "DETECT_FOOD", "PROCESS_IMAGE"],
    description: "Analyzes an uploaded food/kitchen image using ElizaOS vision to extract ingredient names, quantities, and expiry estimates",
    validate: async (_runtime, message) => {
        const content = message.content;
        return !!(content?.imageBase64 || content?.imageUrl || content?.attachments?.length);
    },
    handler: async (runtime, message, _state, _options, callback) => {
        const content = message.content;
        const imageData = content.imageBase64 || content.imageUrl;
        if (!imageData) {
            await callback({ text: "No image data provided. Please upload a food photo." });
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
            const match = result.match(/\{[\s\S]*\}/);
            const parsed = match ? JSON.parse(match[0]) : { ingredients: [], scene_description: "Could not parse" };
            await callback({
                text: `✅ Found ${parsed.ingredients.length} ingredient(s): ${parsed.ingredients.map((i) => i.name).join(", ")}`,
                data: parsed,
            });
        }
        catch (err) {
            await callback({ text: `Vision analysis error: ${err.message}` });
        }
    },
    examples: [
        [
            { user: "user", content: { text: "Here's a photo of my fridge", imageUrl: "data:image/jpeg;base64,..." } },
            { user: "KitchenCopilot", content: { text: "✅ Found 8 ingredients: eggs, milk, spinach, chicken breast, cheddar cheese, carrots, yogurt, butter" } }
        ]
    ],
};
//# sourceMappingURL=visionProcessing.js.map