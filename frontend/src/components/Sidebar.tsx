import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

const navItems = [
    { to: "/dashboard", icon: "🏠", label: "Dashboard" },
    { to: "/inventory", icon: "🥦", label: "Inventory" },
    { to: "/mealplan", icon: "📅", label: "Meal Plan" },
    { to: "/shopping", icon: "🛒", label: "Shopping" },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate("/"); };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">🍽️</div>
                <div className="logo-title">KitchenCopilot</div>
                <div className="logo-subtitle">AI Kitchen Agent</div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ to, icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                    >
                        <span className="nav-icon">{icon}</span>
                        <span className="nav-label">{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="user-chip" style={{ marginBottom: 10 }}>
                    <div className="user-avatar">
                        {user?.displayName?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                        <div className="user-name">{user?.displayName || user?.username}</div>
                        <div className="user-role">Kitchen Chef</div>
                    </div>
                </div>
                <button className="btn btn-ghost btn-sm btn-full" onClick={handleLogout}>
                    🚪 <span className="nav-label">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
