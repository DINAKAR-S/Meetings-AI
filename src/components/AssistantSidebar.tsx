import { Plus, MessageSquare, Search, Clock } from "lucide-react";
import { id } from "@instantdb/react";
import { db } from "@/lib/db";

interface AssistantSidebarProps {
    sessions: any[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
}

export function AssistantSidebar({ sessions, activeSessionId, onSelectSession, onNewChat }: AssistantSidebarProps) {
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div style={{
            width: 280,
            height: "100%",
            borderRight: "1px solid var(--border-light)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-primary)"
        }}>
            <div style={{ padding: 20, borderBottom: "1px solid var(--border-light)" }}>
                <button
                    onClick={onNewChat}
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "flex-start", gap: 10, borderRadius: 12 }}
                >
                    <Plus size={18} /> New Chat
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
                <div style={{ px: 20, mb: 12, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, padding: "0 20px" }}>
                    Recent Conversations
                </div>
                {sortedSessions.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                        No conversations yet.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 10px" }}>
                        {sortedSessions.map((session) => (
                            <button
                                key={session.id}
                                onClick={() => onSelectSession(session.id)}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: activeSessionId === session.id ? "rgba(139, 92, 246, 0.08)" : "transparent",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "all 0.2s"
                                }}
                                className="sidebar-item"
                            >
                                <div style={{
                                    marginTop: 2,
                                    color: activeSessionId === session.id ? "var(--color-indigo)" : "var(--text-tertiary)"
                                }}>
                                    <MessageSquare size={16} />
                                </div>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{
                                        fontSize: 13,
                                        fontWeight: activeSessionId === session.id ? 600 : 500,
                                        color: activeSessionId === session.id ? "var(--text-primary)" : "var(--text-secondary)",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}>
                                        {session.title || "Untitled Chat"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                        <Clock size={10} /> {new Date(session.updatedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: 20, borderTop: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--bg-secondary)", borderRadius: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-indigo)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 14 }}>
                        D
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Dinakar S.</div>
                </div>
            </div>

            <style jsx>{`
                .sidebar-item:hover {
                    background: rgba(0,0,0,0.03) !important;
                }
            `}</style>
        </div>
    );
}
