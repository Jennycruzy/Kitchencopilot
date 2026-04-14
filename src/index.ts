import { AgentRuntime, stringToUuid } from "@elizaos/core";
// @ts-ignore
import { createDatabaseAdapter, DatabaseMigrationService, plugin as SqlPlugin } from "@elizaos/plugin-sql";
import { kitchenPlugin } from "../packages/plugin-kitchen/src/index.js";
import { createApiServer } from "./server.js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🍽️  KitchenCopilot — Autonomous Kitchen AI");
    console.log("🚀 Initializing ElizaOS Agent Runtime...");

    // Load character definition
    const characterPath = path.join(__dirname, "../characters/kitchen-copilot.json");
    const characterJson = fs.readFileSync(characterPath, "utf-8");
    const character = JSON.parse(characterJson);
    const agentId = stringToUuid(character.name || "KitchenCopilot");

    // Initialize Database Adapter — POSTGRES_URL triggers the Postgres adapter which
    // auto-migrates all ElizaOS schema tables on first run.
    // @ts-ignore — 1.7.2 expects (config, agentId)
    const adapter = createDatabaseAdapter({
        dataDir: process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : "./data",
        postgresUrl: process.env.POSTGRES_URL
    }, agentId);

    // Manually trigger migrations for ElizaOS 1.7.2
    try {
        console.log("🗄️  Running database migrations...");
        const migrationService = new DatabaseMigrationService();
        // @ts-ignore
        await (migrationService as any).initializeWithDatabase((adapter as any).db);

        // Register the core SQL plugin schema so core tables (agents, memories, etc.) are created
        // @ts-ignore
        (migrationService as any).registerSchema(SqlPlugin.name, SqlPlugin.schema);

        // Run all migrations
        await (migrationService as any).runAllPluginMigrations();
        console.log("✅ Database migrations completed");
    } catch (err) {
        console.error("❌ Database migration failed:", err);
    }

    const runtime = new AgentRuntime({
        agentId,
        character,
        adapter,
        plugins: [
            kitchenPlugin,
        ],
    });

    await runtime.initialize();

    console.log(`✅ KitchenCopilot agent "${runtime.character.name}" initialized`);
    console.log(`🧠 Model provider: ${(runtime.character as any).modelProvider || 'openai'}`);

    // Start REST API server
    const port = parseInt(process.env.ELIZAOS_PORT || "3000");
    await createApiServer(runtime, port);

    console.log(`🌐 API server running at http://localhost:${port}`);
    console.log(`📡 Frontend expected at ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    console.log("⏰  24h autonomous replanning is active via ReplanningScheduler");
    console.log("\n✨ KitchenCopilot is ready! Reducing food waste, one meal at a time.\n");

    // Graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\n🛑 Shutting down KitchenCopilot...");
        await runtime.stop();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        console.log("\n🛑 Shutting down KitchenCopilot...");
        await runtime.stop();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error("❌ Fatal error starting KitchenCopilot:", error);
    process.exit(1);
});
