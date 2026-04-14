import React, { useState } from "react";
import { authApi } from "../api/client";
import { useAuth } from "../App";

export default function Login() {
    const { login } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [form, setForm] = useState({ username: "", password: "", displayName: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError("");
        try {
            const { data } = isRegister
                ? await authApi.register(form.username, form.password, form.displayName)
                : await authApi.login(form.username, form.password);
            login({ userId: data.userId, username: data.username, displayName: data.displayName }, data.token);
        } catch (err: any) {
            setError(err.response?.data?.error || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-bg">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">🍽️</div>
                    <div className="auth-logo-title">KitchenCopilot</div>
                    <div className="auth-logo-tagline">Your autonomous AI kitchen assistant</div>
                </div>

                {error && <div className="auth-error">⚠️ {error}</div>}

                <form onSubmit={submit}>
                    {isRegister && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="displayName">Display Name</label>
                            <input id="displayName" name="displayName" className="form-input" type="text"
                                placeholder="Chef Gordon" value={form.displayName} onChange={handle} />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label" htmlFor="username">Username</label>
                        <input id="username" name="username" className="form-input" type="text"
                            placeholder="your_username" value={form.username} onChange={handle} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input id="password" name="password" className="form-input" type="password"
                            placeholder="••••••••" value={form.password} onChange={handle} required />
                    </div>
                    <button id="auth-submit" className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                        {loading ? "⏳ Please wait..." : isRegister ? "🚀 Create Account" : "🎉 Sign In"}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isRegister ? "Already have an account? " : "New to KitchenCopilot? "}
                    <a onClick={() => { setIsRegister(!isRegister); setError(""); }}>
                        {isRegister ? "Sign In" : "Create Account"}
                    </a>
                </div>
            </div>
        </div>
    );
}
