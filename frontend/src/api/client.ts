import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("kc_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("kc_token");
            localStorage.removeItem("kc_user");
            window.location.href = "/";
        }
        return Promise.reject(err);
    }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
    register: (username: string, password: string, displayName?: string) =>
        api.post("/auth/register", { username, password, displayName }),
    login: (username: string, password: string) =>
        api.post("/auth/login", { username, password }),
};

// ── Inventory ─────────────────────────────────────────────────
export const inventoryApi = {
    list: () => api.get("/inventory"),
    upload: (file: File) => {
        const fd = new FormData();
        fd.append("image", file);
        return api.post("/inventory/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    bulkSave: (data: { items: any[], inventory_name: string, clear_existing: boolean }) => api.post("/inventory/bulk", data),
    clear: (inventory_name: string) => api.post("/inventory/clear", { inventory_name }),
    update: (id: string, data: any) => api.put(`/inventory/${id}`, data),
    remove: (id: string) => api.delete(`/inventory/${id}`),
};

// ── Meal Plan ─────────────────────────────────────────────────
export const mealPlanApi = {
    get: () => api.get("/mealplan"),
    generate: (inventories?: string[]) => api.post("/mealplan/generate", { inventories }),
};

// ── Shopping List ─────────────────────────────────────────────
export const shoppingApi = {
    get: () => api.get("/shopping-list"),
};

// ── Budget ────────────────────────────────────────────────────
export const budgetApi = {
    get: () => api.get("/budget"),
    set: (weekly_budget: number) => api.post("/budget", { weekly_budget }),
};

// ── Profile ───────────────────────────────────────────────────
export const profileApi = {
    get: () => api.get("/profile"),
    update: (data: any) => api.put("/profile", data),
};

// ── Voice ─────────────────────────────────────────────────────
export const voiceApi = {
    send: (transcript: string) => api.post("/voice", { transcript }),
};
