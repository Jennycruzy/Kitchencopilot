import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AgentRuntime, stringToUuid, ModelType } from "@elizaos/core";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "kitchen_copilot_dev_secret";
const DB_PATH = process.env.DATABASE_PATH || "./data/kitchensync.db";

// ── Database setup ─────────────────────────────────────────────────────────
function getDb(): Database.Database {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new Database(DB_PATH);

    db.exec(`
    CREATE TABLE IF NOT EXISTS kc_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS kc_profiles (
      user_id TEXT PRIMARY KEY,
      dietary_restrictions TEXT DEFAULT '[]',
      cuisine_preferences TEXT DEFAULT '[]',
      cooking_skill TEXT DEFAULT 'intermediate',
      household_size INTEGER DEFAULT 1,
      weekly_budget REAL DEFAULT 0,
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES kc_users(id)
    );

    CREATE TABLE IF NOT EXISTS kc_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT,
      unit TEXT,
      category TEXT,
      expiry_label TEXT DEFAULT 'unknown',
      expiry_days INTEGER,
      purchase_date INTEGER,
      detected_at INTEGER DEFAULT (strftime('%s', 'now')),
      image_source TEXT,
      FOREIGN KEY (user_id) REFERENCES kc_users(id)
    );

    CREATE TABLE IF NOT EXISTS kc_meal_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      plan_data TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES kc_users(id)
    );

    CREATE TABLE IF NOT EXISTS kc_shopping_lists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items TEXT NOT NULL,
      estimated_cost REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES kc_users(id)
    );
  `);

    try { db.exec("ALTER TABLE kc_inventory ADD COLUMN emoji TEXT DEFAULT '🥗'"); } catch (_) { }
    try { db.exec("ALTER TABLE kc_inventory ADD COLUMN inventory_name TEXT DEFAULT 'Main'"); } catch (_) { }

    return db;
}

// ── Auth helpers ───────────────────────────────────────────────────────────
function verifyToken(req: Request, res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string; username: string };
        (req as any).user = decoded;
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}

// ── File upload ────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only images are accepted"));
    },
});

// ── API Server ──────────────────────────────────────────────────────────────
export async function createApiServer(runtime: AgentRuntime, port: number): Promise<void> {
    const app = express();
    const db = getDb();

    app.use(cors({
        origin: [
            process.env.FRONTEND_URL || "http://localhost:5173",
            "http://localhost:8080",
        ],
        credentials: true,
    }));
    app.use(express.json({ limit: "50mb" }));

    // Serve built frontend in production
    const publicDir = path.join(process.cwd(), "public");
    if (fs.existsSync(publicDir)) {
        // Explicitly set cache-control for index.html to avoid stale PWA bundles
        app.get("/", (_req, res) => {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.sendFile(path.join(publicDir, "index.html"));
        });
        app.use(express.static(publicDir, {
            maxAge: "1d",
            setHeaders: (res, path) => {
                if (path.endsWith(".html")) {
                    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                }
            }
        }));
    }

    // ── Auth Routes ──────────────────────────────────────────────────────────

    app.post("/api/auth/register", async (req: Request, res: Response) => {
        try {
            const { username, password, displayName } = req.body;
            if (!username || !password) {
                res.status(400).json({ error: "Username and password required" });
                return;
            }
            const userId = stringToUuid(username + Date.now());
            const hash = await bcrypt.hash(password, 12);

            const existing = db.prepare("SELECT id FROM kc_users WHERE username = ?").get(username);
            if (existing) {
                res.status(409).json({ error: "Username already taken" });
                return;
            }

            db.prepare("INSERT INTO kc_users (id, username, password_hash, display_name) VALUES (?, ?, ?, ?)")
                .run(userId, username.toLowerCase(), hash, displayName || username);
            db.prepare("INSERT INTO kc_profiles (user_id) VALUES (?)").run(userId);

            const token = jwt.sign({ userId, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: "30d" });
            res.status(201).json({ token, userId, username: username.toLowerCase(), displayName: displayName || username });
        } catch (err: any) {
            console.error("Register error:", err);
            res.status(500).json({ error: "Registration failed" });
        }
    });

    app.post("/api/auth/login", async (req: Request, res: Response) => {
        try {
            const { username, password } = req.body;
            const user = db.prepare("SELECT * FROM kc_users WHERE username = ?").get(username?.toLowerCase()) as any;
            if (!user) {
                res.status(401).json({ error: "Invalid credentials" });
                return;
            }
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                res.status(401).json({ error: "Invalid credentials" });
                return;
            }
            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
            res.json({ token, userId: user.id, username: user.username, displayName: user.display_name });
        } catch (err: any) {
            console.error("Login error:", err);
            res.status(500).json({ error: "Login failed" });
        }
    });

    // ── Profile Routes ───────────────────────────────────────────────────────

    app.get("/api/profile", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const profile = db.prepare("SELECT * FROM kc_profiles WHERE user_id = ?").get(userId) as any;
        if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
        res.json({
            ...profile,
            dietary_restrictions: JSON.parse(profile.dietary_restrictions || "[]"),
            cuisine_preferences: JSON.parse(profile.cuisine_preferences || "[]"),
        });
    });

    app.put("/api/profile", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const { dietary_restrictions, cuisine_preferences, cooking_skill, household_size, weekly_budget } = req.body;
        db.prepare(`
      UPDATE kc_profiles SET
        dietary_restrictions = ?,
        cuisine_preferences = ?,
        cooking_skill = ?,
        household_size = ?,
        weekly_budget = ?,
        updated_at = strftime('%s', 'now')
      WHERE user_id = ?
    `).run(
            JSON.stringify(dietary_restrictions || []),
            JSON.stringify(cuisine_preferences || []),
            cooking_skill || "intermediate",
            household_size || 1,
            weekly_budget || 0,
            userId,
        );
        res.json({ success: true });
    });

    // ── Inventory Routes ─────────────────────────────────────────────────────

    app.get("/api/inventory", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const items = db.prepare("SELECT * FROM kc_inventory WHERE user_id = ? ORDER BY expiry_days ASC, detected_at DESC").all(userId);
        res.json(items);
    });

    app.post("/api/inventory/upload", verifyToken, upload.single("image"), async (req: Request, res: Response) => {
        try {
            const { userId } = (req as any).user;
            if (!req.file) {
                res.status(400).json({ error: "No image provided" });
                return;
            }

            const imageBase64 = req.file.buffer.toString("base64");
            const mimeType = req.file.mimetype;

            // Use ElizaOS AgentRuntime for vision analysis
            const prompt = `You are analyzing a food/kitchen image. Your task:
1. List ALL visible food items, ingredients, and products
2. For each item provide: name, estimated quantity, unit, category (produce/dairy/protein/pantry/frozen/condiment/beverage/other), and a single representative emoji (e.g. 🥕 for carrots)
3. Estimate expiry: "1-3 days" / "4-7 days" / "1-2 weeks" / "2-4 weeks" / "1+ months"
4. Suggest a short list of 2-4 missing but essential kitchen items that complement these ingredients to buy.
5. Note visual freshness if applicable

Return ONLY valid JSON in this exact format:
{
  "ingredients": [
    {
      "name": "string",
      "quantity": "string or number",
      "unit": "string (pieces/g/kg/ml/L/cups/etc)",
      "category": "string",
      "emoji": "emoji string",
      "expiry_label": "string",
      "expiry_days": number,
      "freshness_note": "string or null"
    }
  ],
  "suggested_purchases": ["item 1", "item 2"],
  "scene_description": "string"
}`;

            let detected: any = { ingredients: [], suggested_purchases: [], scene_description: "Analysis pending" };

            try {
                // Custom fallback for Ollama to handle vision since core lacks the delegate
                const modelProvider = (runtime.character as any).modelProvider || "openai";
                let responseText = "";

                if (modelProvider === "ollama") {
                    const ollamaUrl = (process.env.OLLAMA_SERVER_URL || "http://localhost:11434").replace(/\/$/, "");

                    // Nosana Open-WebUI proxy usually hosts Ollama natively at /ollama/api/generate or raw /api/generate
                    const apiUrl = ollamaUrl.includes("anon.nosana.io") && !ollamaUrl.includes("/api")
                        ? `${ollamaUrl}/api/generate`
                        : `${ollamaUrl}/api/generate`;

                    let fetchResponse = await fetch(apiUrl.replace("/api/api", "/api"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: process.env.OLLAMA_MODEL || "llama3.2-vision:latest",
                            prompt: prompt,
                            images: [imageBase64],
                            stream: false
                        })
                    });

                    if (fetchResponse.status === 404) {
                        try {
                            const pullUrl = apiUrl.replace("/api/api", "/api").replace("/generate", "/pull");
                            await fetch(pullUrl, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: process.env.OLLAMA_MODEL || "llama3.2-vision:latest", stream: false })
                            });
                            // Retry after pull
                            fetchResponse = await fetch(apiUrl.replace("/api/api", "/api"), {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    model: process.env.OLLAMA_MODEL || "llama3.2-vision:latest",
                                    prompt: prompt,
                                    images: [imageBase64],
                                    stream: false
                                })
                            });
                        } catch (e) {
                            console.error("Auto-pull failed:", e);
                        }
                    }

                    const response = (await fetchResponse.json()) as any;
                    responseText = response.response || "";
                } else {
                    responseText = (await runtime.useModel(ModelType.IMAGE_DESCRIPTION, {
                        imageUrl: `data:${mimeType};base64,${imageBase64}`,
                        prompt,
                    })) as unknown as string;
                }

                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    detected = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: ask the LLM to extract from free text
                    const fallbackPrompt = `Convert this food description to JSON. Use this exact format:
{
  "ingredients": [
    {
      "name": "string",
      "quantity": "string or number",
      "unit": "string",
      "category": "string",
      "emoji": "emoji string",
      "expiry_label": "string",
      "expiry_days": number,
      "freshness_note": "string or null"
    }
  ],
  "suggested_purchases": ["item 1", "item 2"],
  "scene_description": "string"
}

Food description: ${responseText}`;
                    const structuredResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
                        prompt: fallbackPrompt,
                    });
                    const match2 = (structuredResponse as unknown as string).match(/\{[\s\S]*\}/);
                    if (match2) detected = JSON.parse(match2[0]);
                }
            } catch (visionErr: any) {
                console.error("Vision analysis error:", visionErr);
                throw new Error("AI Analysis Timeout or Failure: " + (visionErr.message || "Unknown error"));
            }

            // Return detected items without saving to db!
            const previewItems = (detected.ingredients || []).map((item: any) => ({
                id: stringToUuid(`${userId}-${item.name}-${Date.now()}-${Math.random()}`),
                ...item,
                inventory_name: "Main"
            }));

            res.json({
                success: true,
                detected: previewItems,
                suggested_purchases: detected.suggested_purchases || [],
                scene_description: detected.scene_description,
                count: previewItems.length,
            });
        } catch (err: any) {
            console.error("Upload error:", err);
            res.status(500).json({ error: "Image analysis failed: " + err.message });
        }
    });

    app.post("/api/inventory/bulk", verifyToken, (req: Request, res: Response) => {
        try {
            const { userId } = (req as any).user;
            const { items, inventory_name, clear_existing } = req.body;

            if (clear_existing && inventory_name) {
                db.prepare("DELETE FROM kc_inventory WHERE user_id=? AND inventory_name=?").run(userId, inventory_name);
            }

            const stmt = db.prepare(`
                INSERT INTO kc_inventory (id, user_id, name, quantity, unit, category, emoji, expiry_label, expiry_days, purchase_date, image_source, inventory_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), ?, ?)
            `);

            for (const item of (items || [])) {
                stmt.run(
                    item.id || stringToUuid(`${userId}-bulk-${Date.now()}-${Math.random()}`),
                    userId,
                    item.name,
                    String(item.quantity || ""),
                    item.unit || "units",
                    item.category || "other",
                    item.emoji || "🥗",
                    item.expiry_label || "unknown",
                    item.expiry_days ?? null,
                    "upload",
                    inventory_name || item.inventory_name || "Main"
                );
            }
            res.json({ success: true, count: (items || []).length });
        } catch (err: any) {
            console.error("Bulk save error:", err);
            res.status(500).json({ error: "Failed to save ingredients" });
        }
    });

    app.post("/api/inventory/clear", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const { inventory_name } = req.body;
        if (!inventory_name) { res.status(400).json({ error: "Require inventory_name" }); return; }
        db.prepare("DELETE FROM kc_inventory WHERE user_id=? AND inventory_name=?").run(userId, inventory_name);
        res.json({ success: true });
    });

    app.put("/api/inventory/:id", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const { id } = req.params;
        const { name, quantity, unit, category, expiry_label, expiry_days } = req.body;
        db.prepare(`
      UPDATE kc_inventory SET name=?, quantity=?, unit=?, category=?, expiry_label=?, expiry_days=?
      WHERE id=? AND user_id=?
    `).run(name, quantity, unit, category, expiry_label, expiry_days, id, userId);
        res.json({ success: true });
    });

    app.delete("/api/inventory/:id", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        db.prepare("DELETE FROM kc_inventory WHERE id=? AND user_id=?").run(req.params.id, userId);
        res.json({ success: true });
    });

    // ── Meal Plan Routes ─────────────────────────────────────────────────────

    app.get("/api/mealplan", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const plan = db.prepare(
            "SELECT * FROM kc_meal_plans WHERE user_id=? ORDER BY created_at DESC LIMIT 1"
        ).get(userId) as any;

        if (!plan) { res.json({ plan: null, message: "No meal plan generated yet" }); return; }
        res.json({ ...plan, plan_data: JSON.parse(plan.plan_data) });
    });

    app.post("/api/mealplan/generate", verifyToken, async (req: Request, res: Response) => {
        try {
            const { userId } = (req as any).user;
            const { inventories } = req.body || {}; // e.g., ["Fridge", "Pantry"]

            let inventory = [];
            if (inventories && Array.isArray(inventories) && inventories.length > 0) {
                const marks = inventories.map(() => '?').join(',');
                inventory = db.prepare(`SELECT * FROM kc_inventory WHERE user_id=? AND inventory_name IN (${marks}) ORDER BY expiry_days ASC`).all(userId, ...inventories) as any[];
            } else {
                inventory = db.prepare("SELECT * FROM kc_inventory WHERE user_id=? ORDER BY expiry_days ASC").all(userId) as any[];
            }
            const profile = db.prepare("SELECT * FROM kc_profiles WHERE user_id=?").get(userId) as any;

            if (inventory.length === 0) {
                res.status(400).json({ error: "No inventory found. Please upload ingredient photos first." });
                return;
            }

            const inventoryList = inventory.map(i =>
                `- ${i.name}: ${i.quantity} ${i.unit} [expires: ${i.expiry_label || "unknown"}]`
            ).join("\n");

            const restrictions = profile ? JSON.parse(profile.dietary_restrictions || "[]") : [];
            const cuisines = profile ? JSON.parse(profile.cuisine_preferences || "[]") : [];
            const budget = profile?.weekly_budget || 0;

            const todayDate = new Date().toISOString().split("T")[0];
            const prompt = `You are KitchenCopilot generating a 7-day meal plan starting from today, ${todayDate}.

CURRENT INVENTORY (prioritize items expiring soonest):
${inventoryList}

USER PROFILE:
- Dietary restrictions: ${restrictions.length ? restrictions.join(", ") : "None"}
- Cuisine preferences: ${cuisines.length ? cuisines.join(", ") : "Any"}
- Household size: ${profile?.household_size || 1} person(s)
- Weekly budget: ${budget > 0 ? "$" + budget : "Not set"}
- Cooking skill: ${profile?.cooking_skill || "intermediate"}

RULES:
1. Use expiring-soon items FIRST (especially items expiring in 1-7 days)
2. Maximize use of available inventory before suggesting new purchases
3. Each day should have breakfast, lunch, and dinner
4. Each meal should list which inventory ingredients it uses
5. Flag meals that need any additional ingredients to purchase

Return ONLY valid JSON:
{
  "week_start": "YYYY-MM-DD",
  "efficiency_score": number (0-100, % of inventory used),
  "expiring_used": ["item1", "item2"],
  "days": [
    {
      "day": "Monday",
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": {
          "name": "string",
          "ingredients_used": ["string"],
          "needs_shopping": ["string"],
          "prep_minutes": number,
          "calories_est": number
        },
        "lunch": { ... },
        "dinner": { ... }
      }
    }
  ]
}`;

            const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
            const jsonMatch = (response as string).match(/\{[\s\S]*\}/);

            if (!jsonMatch) throw new Error("Failed to parse meal plan from AI response");

            const planData = JSON.parse(jsonMatch[0]);
            const planId = stringToUuid(`mealplan-${userId}-${Date.now()}`);
            const weekStart = new Date().toISOString().split("T")[0];

            db.prepare("INSERT INTO kc_meal_plans (id, user_id, week_start, plan_data) VALUES (?, ?, ?, ?)")
                .run(planId, userId, weekStart, JSON.stringify(planData));

            res.json({ id: planId, plan_data: planData, week_start: weekStart });
        } catch (err: any) {
            console.error("Meal plan error:", err);
            res.status(500).json({ error: "Meal plan generation failed: " + err.message });
        }
    });

    // ── Shopping List Routes ─────────────────────────────────────────────────

    app.get("/api/shopping-list", verifyToken, async (req: Request, res: Response) => {
        try {
            const { userId } = (req as any).user;

            // Get latest meal plan
            const plan = db.prepare(
                "SELECT * FROM kc_meal_plans WHERE user_id=? ORDER BY created_at DESC LIMIT 1"
            ).get(userId) as any;

            const inventory = db.prepare("SELECT name FROM kc_inventory WHERE user_id=?").all(userId) as any[];
            const inventoryNames = inventory.map((i: any) => i.name.toLowerCase());

            if (!plan) {
                res.json({ items: [], message: "Generate a meal plan first", estimated_total: 0 });
                return;
            }

            const planData = JSON.parse(plan.plan_data);
            const needed = new Set<string>();

            for (const day of planData.days || []) {
                for (const meal of Object.values(day.meals || {})) {
                    for (const item of (meal as any).needs_shopping || []) {
                        if (!inventoryNames.some(inv => inv.includes(item.toLowerCase()))) {
                            needed.add(item);
                        }
                    }
                }
            }

            // Estimate costs via LLM
            const profile = db.prepare("SELECT * FROM kc_profiles WHERE user_id=?").get(userId) as any;
            const budget = profile?.weekly_budget || 0;

            const itemArray = Array.from(needed);
            let itemsWithCost: any[] = itemArray.map(name => ({ name, estimated_cost: null, checked: false }));

            if (itemArray.length > 0) {
                try {
                    const costPrompt = `Estimate US grocery prices for these items. Return ONLY JSON array:
Items: ${itemArray.join(", ")}

[{"name":"item","estimated_cost":1.99,"unit":"each/lb/oz"},...]`;

                    const costResp = await runtime.useModel(ModelType.TEXT_SMALL, { prompt: costPrompt });
                    const match = (costResp as string).match(/\[[\s\S]*\]/);
                    if (match) {
                        const priced = JSON.parse(match[0]);
                        itemsWithCost = priced.map((p: any) => ({ ...p, checked: false }));
                    }
                } catch (_) { /* use items without prices */ }
            }

            const estimatedTotal = itemsWithCost.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

            // Store
            const listId = stringToUuid(`shoplist-${userId}-${Date.now()}`);
            db.prepare("INSERT INTO kc_shopping_lists (id, user_id, items, estimated_cost) VALUES (?, ?, ?, ?)")
                .run(listId, userId, JSON.stringify(itemsWithCost), estimatedTotal);

            res.json({
                id: listId,
                items: itemsWithCost,
                estimated_total: Math.round(estimatedTotal * 100) / 100,
                budget,
                within_budget: budget > 0 ? estimatedTotal <= budget : null,
            });
        } catch (err: any) {
            console.error("Shopping list error:", err);
            res.status(500).json({ error: "Shopping list generation failed" });
        }
    });

    // ── Budget Routes ────────────────────────────────────────────────────────

    app.get("/api/budget", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const profile = db.prepare("SELECT weekly_budget FROM kc_profiles WHERE user_id=?").get(userId) as any;
        const lastList = db.prepare(
            "SELECT estimated_cost FROM kc_shopping_lists WHERE user_id=? ORDER BY created_at DESC LIMIT 1"
        ).get(userId) as any;
        res.json({
            weekly_budget: profile?.weekly_budget || 0,
            estimated_spend: lastList?.estimated_cost || 0,
        });
    });

    app.post("/api/budget", verifyToken, (req: Request, res: Response) => {
        const { userId } = (req as any).user;
        const { weekly_budget } = req.body;
        db.prepare("UPDATE kc_profiles SET weekly_budget=? WHERE user_id=?").run(weekly_budget || 0, userId);
        res.json({ success: true, weekly_budget });
    });

    // ── Voice Command Route ──────────────────────────────────────────────────

    app.post("/api/voice", verifyToken, async (req: Request, res: Response) => {
        try {
            const { userId, username } = (req as any).user;
            const { transcript } = req.body;
            if (!transcript) { res.status(400).json({ error: "No transcript provided" }); return; }

            const inventory = db.prepare(
                "SELECT name, quantity, unit, expiry_label FROM kc_inventory WHERE user_id=?"
            ).all(userId) as any[];

            const inventoryList = inventory.length
                ? inventory.map(i => `${i.name}: ${i.quantity} ${i.unit} [${i.expiry_label}]`).join(", ")
                : "No inventory yet";

            // Route voice command through ElizaOS runtime reasoning
            const routingPrompt = `You are KitchenCopilot processing a voice command.

User's inventory: ${inventoryList}
Voice command: "${transcript}"

Determine the intent and respond helpfully. If the command is about:
- "what can I cook" → suggest meals from inventory
- "I used [item]" → acknowledge and note to remove it
- "add [item] to shopping list" → confirm addition
- "plan meals" → trigger meal planning
- "set budget to $X" → confirm budget setting
- General question → answer directly

Respond in a warm, conversational tone (2-3 sentences max). Also return the action type.

Return JSON:
{
  "response": "spoken response text",
  "action": "SUGGEST_MEALS|REMOVE_ITEM|ADD_SHOPPING|PLAN_MEALS|SET_BUDGET|GENERAL",
  "item": "extracted item name or null",
  "amount": extracted number or null
}`;

            const aiResponse = await runtime.useModel(ModelType.TEXT_SMALL, { prompt: routingPrompt });
            const match = (aiResponse as unknown as string).match(/\{[\s\S]*\}/);

            let result = { response: "I understood your request. Let me help with that!", action: "GENERAL", item: null, amount: null };
            if (match) {
                try { result = { ...result, ...JSON.parse(match[0]) }; } catch (_) { }
            }

            // Execute side effects based on action
            if (result.action === "REMOVE_ITEM" && typeof result.item === 'string') {
                db.prepare("DELETE FROM kc_inventory WHERE user_id=? AND LOWER(name) LIKE ?")
                    .run(userId, `%${(result.item as string).toLowerCase()}%`);
            }
            if (result.action === "SET_BUDGET" && result.amount) {
                db.prepare("UPDATE kc_profiles SET weekly_budget=? WHERE user_id=?").run(result.amount, userId);
            }

            res.json(result);
        } catch (err: any) {
            console.error("Voice command error:", err);
            res.status(500).json({ error: "Voice processing failed" });
        }
    });

    // ── Health check ─────────────────────────────────────────────────────────
    app.get("/api/health", (_req, res) => {
        res.json({
            status: "ok",
            agent: "KitchenCopilot",
            version: "1.0.0",
            model: (runtime.character as any)?.modelProvider || "unknown",
            timestamp: new Date().toISOString(),
        });
    });

    // ── SPA Fallback ─────────────────────────────────────────────────────────
    if (fs.existsSync(publicDir)) {
        app.get("*", (req, res, next) => {
            if (req.path.startsWith("/api/")) return next();
            // Do NOT serve index.html for missing asset files (like .js, .css, .png)
            if (req.path.includes(".")) {
                res.status(404).send("Not found");
                return;
            }
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.sendFile(path.join(publicDir, "index.html"));
        });
    }

    app.listen(port, "0.0.0.0");
}
