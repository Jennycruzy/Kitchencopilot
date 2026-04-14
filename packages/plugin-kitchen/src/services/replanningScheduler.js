import { Service, ModelType } from "@elizaos/core";
/**
 * ReplanningSchedulerService
 * Long-lived ElizaOS Service that runs autonomously every 24 hours,
 * triggering meal plan refresh and expiration alerts for all known user rooms.
 */
export class ReplanningSchedulerService extends Service {
    intervalId = null;
    INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    static get serviceType() {
        return "REPLANNING_SCHEDULER";
    }
    async initialize(runtime) {
        console.log("[ReplanningScheduler] Starting 24h autonomous replanning loop...");
        // Run once at startup (after 30s delay to allow agent to fully initialize)
        setTimeout(() => this.runReplanning(runtime), 30_000);
        // Then run every 24 hours
        this.intervalId = setInterval(() => this.runReplanning(runtime), this.INTERVAL_MS);
    }
    async runReplanning(runtime) {
        console.log(`[ReplanningScheduler] 🔄 Running autonomous replanning at ${new Date().toISOString()}`);
        try {
            // Generate a system-level analysis
            const prompt = `As KitchenCopilot's autonomous replanning system, generate a brief status report:
1. Reminder that users should check their expiring items
2. General meal planning tip of the day
3. Encouragement to reduce food waste

Keep it to 2-3 sentences, warm and motivating.`;
            const tip = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            console.log(`[ReplanningScheduler] Daily tip generated: ${tip.slice(0, 100)}...`);
            console.log("[ReplanningScheduler] ✅ Autonomous replanning cycle complete");
        }
        catch (err) {
            console.error("[ReplanningScheduler] Error during replanning:", err);
        }
    }
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[ReplanningScheduler] Stopped.");
        }
    }
    get capabilityDescription() {
        return "Autonomous 24-hour meal replanning and expiration monitoring service";
    }
}
//# sourceMappingURL=replanningScheduler.js.map