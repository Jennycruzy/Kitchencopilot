import { type IAgentRuntime, Service } from "@elizaos/core";
/**
 * ReplanningSchedulerService
 * Long-lived ElizaOS Service that runs autonomously every 24 hours,
 * triggering meal plan refresh and expiration alerts for all known user rooms.
 */
export declare class ReplanningSchedulerService extends Service {
    private intervalId;
    private readonly INTERVAL_MS;
    static get serviceType(): ServiceType;
    initialize(runtime: IAgentRuntime): Promise<void>;
    private runReplanning;
    stop(): Promise<void>;
    get capabilityDescription(): string;
}
//# sourceMappingURL=replanningScheduler.d.ts.map