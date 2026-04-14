import React, { createContext, useContext, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import MealPlan from "./pages/MealPlan";
import ShoppingList from "./pages/ShoppingList";
import Sidebar from "./components/Sidebar";
import VoiceButton from "./components/VoiceButton";

// ── Auth Context ──────────────────────────────────────────────
interface User { userId: string; username: string; displayName: string; }
interface AuthCtx { user: User | null; login: (u: User, token: string) => void; logout: () => void; }

export const AuthContext = createContext<AuthCtx>({ user: null, login: () => { }, logout: () => { } });
export const useAuth = () => useContext(AuthContext);

// ── Toast Context ─────────────────────────────────────────────
interface ToastCtx { showToast: (msg: string) => void; }
export const ToastContext = createContext<ToastCtx>({ showToast: () => { } });
export const useToast = () => useContext(ToastContext);

function AppContent() {
    const { user } = useAuth();
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    if (!user) return <Login />;

    return (
        <ToastContext.Provider value={{ showToast }}>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/mealplan" element={<MealPlan />} />
                        <Route path="/shopping" element={<ShoppingList />} />
                    </Routes>
                </main>
                <VoiceButton />
                {toast && <div className="toast">✨ {toast}</div>}
            </div>
        </ToastContext.Provider>
    );
}

export default function App() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem("kc_user");
        const token = localStorage.getItem("kc_token");
        if (saved && token) {
            try { setUser(JSON.parse(saved)); } catch { localStorage.clear(); }
        }
    }, []);

    const login = (u: User, token: string) => {
        setUser(u);
        localStorage.setItem("kc_user", JSON.stringify(u));
        localStorage.setItem("kc_token", token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("kc_user");
        localStorage.removeItem("kc_token");
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthContext.Provider>
    );
}
