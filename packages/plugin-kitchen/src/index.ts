import type { Plugin } from "@elizaos/core";

import { visionProcessingAction } from "./actions/visionProcessing.js";
import { inventoryManagementAction } from "./actions/inventoryManagement.js";
import { recipeMatchingAction } from "./actions/recipeMatching.js";
import { mealPlanningAction } from "./actions/mealPlanning.js";
import { shoppingListAction } from "./actions/shoppingList.js";
import { expirationAnalysisAction } from "./actions/expirationAnalysis.js";
import { budgetPlanningAction } from "./actions/budgetPlanning.js";
import { voiceInputAction } from "./actions/voiceInput.js";

import { inventoryProvider } from "./providers/inventoryProvider.js";
import { userContextProvider } from "./providers/userContextProvider.js";

import { inventoryEvaluator } from "./evaluators/inventoryEvaluator.js";

import { ReplanningSchedulerService } from "./services/replanningScheduler.js";

export const kitchenPlugin: Plugin = {
    name: "plugin-kitchen",
    description: "KitchenCopilot core plugin — autonomous food waste reduction agent",

    actions: [
        visionProcessingAction,
        inventoryManagementAction,
        recipeMatchingAction,
        mealPlanningAction,
        shoppingListAction,
        expirationAnalysisAction,
        budgetPlanningAction,
        voiceInputAction,
    ],

    providers: [
        inventoryProvider,
        userContextProvider,
    ],

    evaluators: [
        inventoryEvaluator,
    ],

    /*
        services: [
            ReplanningSchedulerService,
        ],
        */
};

export default kitchenPlugin;
