"use client";

import { usePathname, useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useState, useRef, useEffect } from "react";

const pageTitles: Record<string, string> = {
    "/": "Dashboard",
    "/projects": "Projects",
    "/sprint-board": "Sprint Board",
    "/backlog": "Backlog",
    "/meetings": "Meetings",
    "/workload": "Developer Workload",
    "/teams": "Teams",
};

export default function TopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const title = pageTitles[pathname] || "SprintMind";

    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    const { data } = db.useQuery({ tasks: { project: {} }, activityLogs: {} });
    const allTasks = data?.tasks || [];
    const allLogs = data?.activityLogs || [];

    // Filter tasks by search query
    const searchResults = searchQuery.trim().length > 1
        ? allTasks.filter((t: any) =>
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 8)
        : [];

    // Recent activity logs sorted by time
    const recentLogs = [...allLogs]
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10);

    useEffect(() => {
        if (showSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [showSearch]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearch(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Keyboard shortcut: Ctrl+K to open search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(prev => !prev);
                setShowNotifications(false);
            }
            if (e.key === "Escape") {
                setShowSearch(false);
                setShowNotifications(false);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            backlog: "var(--status-backlog)",
            ready: "var(--status-ready)",
            in_progress: "var(--status-in-progress)",
            review: "var(--status-review)",
            testing: "var(--status-testing)",
            done: "var(--status-done)",
        };
        return colors[status] || "var(--text-tertiary)";
    };

    return (
        <header className="top-bar">
            <h2 className="top-bar-title">{title}</h2>
            <div className="top-bar-actions">
                {/* Search */}
                <div ref={searchRef} style={{ position: "relative" }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ gap: 4 }}
                        onClick={() => { setShowSearch(!showSearch); setShowNotifications(false); }}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        Search
                    </button>

                    {showSearch && (
                        <div style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            width: 380,
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
                            zIndex: 1000,
                            overflow: "hidden",
                        }}>
                            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)" }}>
                                <input
                                    ref={searchInputRef}
                                    className="form-input"
                                    placeholder="Search tasks... (Ctrl+K)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ border: "none", padding: 0, fontSize: 14, background: "transparent", outline: "none", boxShadow: "none" }}
                                />
                            </div>
                            <div style={{ maxHeight: 320, overflowY: "auto" }}>
                                {searchQuery.trim().length < 2 ? (
                                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                                        Type at least 2 characters to search...
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                                        No tasks found for "{searchQuery}"
                                    </div>
                                ) : (
                                    searchResults.map((task: any) => (
                                        <div
                                            key={task.id}
                                            className="hover-card"
                                            style={{
                                                padding: "10px 16px",
                                                cursor: "pointer",
                                                borderBottom: "1px solid var(--border-light)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                            }}
                                            onClick={() => {
                                                // Navigate to project sprint board or backlog based on whether task has a project
                                                if (task.project?.[0]) {
                                                    router.push(`/projects/${task.project[0].id}/backlog`);
                                                } else {
                                                    router.push("/backlog");
                                                }
                                                setShowSearch(false);
                                                setSearchQuery("");
                                            }}
                                        >
                                            <span style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: getStatusColor(task.status),
                                                flexShrink: 0,
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {task.title}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                                                    {task.status.replace("_", " ")} • {task.priority}
                                                    {task.project?.[0] && ` • ${task.project[0].name}`}
                                                </div>
                                            </div>
                                            <span className={`badge badge-${task.priority}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                                {task.priority}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div ref={notifRef} style={{ position: "relative" }}>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); }}
                        style={{ position: "relative" }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                        </svg>
                        {recentLogs.length > 0 && (
                            <span style={{
                                position: "absolute", top: 2, right: 2,
                                width: 8, height: 8, borderRadius: "50%",
                                background: "#ef4444",
                            }} />
                        )}
                    </button>

                    {showNotifications && (
                        <div style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            width: 360,
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
                            zIndex: 1000,
                            overflow: "hidden",
                        }}>
                            <div style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid var(--border-light)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}>
                                <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
                                <span className="badge badge-medium" style={{ fontSize: 10 }}>{recentLogs.length}</span>
                            </div>
                            <div style={{ maxHeight: 360, overflowY: "auto" }}>
                                {recentLogs.length === 0 ? (
                                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                                        No recent activity
                                    </div>
                                ) : (
                                    recentLogs.map((log: any) => (
                                        <div
                                            key={log.id}
                                            style={{
                                                padding: "10px 16px",
                                                borderBottom: "1px solid var(--border-light)",
                                                display: "flex",
                                                gap: 10,
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <div style={{
                                                width: 28, height: 28, borderRadius: "50%",
                                                background: log.action?.includes("Assigned") ? "rgba(20, 184, 139, 0.1)"
                                                    : log.action?.includes("created") ? "rgba(59, 130, 246, 0.1)"
                                                        : log.action?.includes("Moved") ? "rgba(249, 115, 22, 0.1)"
                                                            : "var(--bg-secondary)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                flexShrink: 0,
                                                fontSize: 12,
                                            }}>
                                                {log.action?.includes("Assigned") ? "👤"
                                                    : log.action?.includes("created") ? "✨"
                                                        : log.action?.includes("Moved") ? "→"
                                                            : "📋"}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>
                                                    {log.action}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                                    {log.createdAt ? new Date(log.createdAt).toLocaleString([], {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    }) : "Unknown time"}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
