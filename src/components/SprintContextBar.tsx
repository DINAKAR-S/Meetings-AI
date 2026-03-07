"use client";

import { db } from "@/lib/db";

export function SprintContextBar() {
    const { isLoading, data } = db.useQuery({
        sprints: {},
        tasks: {},
    });

    if (isLoading) return null;

    const sprints = data?.sprints || [];
    const allTasks = data?.tasks || [];

    const activeSprint = sprints.find((s: any) => s.status === "active") ||
        sprints.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0];

    if (!activeSprint) return null;

    const sprintTasks = allTasks.filter((t: any) => t.sprintId === activeSprint.id);
    const totalPoints = sprintTasks.reduce((s: number, t: any) => s + (t.storyPoints || 3), 0);
    const capacity = activeSprint.capacity || 0;

    // progress
    const doneTasks = sprintTasks.filter((t: any) => t.status === "done").length;
    const totalTasks = sprintTasks.length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Timeline calculations
    const today = new Date();
    // Assuming startDate and endDate are YYYY-MM-DD
    const start = activeSprint.startDate ? new Date(activeSprint.startDate) : null;
    const end = activeSprint.endDate ? new Date(activeSprint.endDate) : null;

    let daysLeftText = "";
    let daysPercent = 0;

    if (start && end) {
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = today.getTime() - start.getTime();
        if (elapsed < 0) {
            daysLeftText = `Starts in ${Math.ceil(Math.abs(elapsed) / (1000 * 60 * 60 * 24))} days`;
            daysPercent = 0;
        } else if (today > end) {
            daysLeftText = "Sprint ended";
            daysPercent = 100;
        } else {
            const left = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            daysLeftText = `${left} days left`;
            daysPercent = Math.min(100, Math.round((elapsed / totalDuration) * 100));
        }
    }

    return (
        <div style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 24px",
            marginBottom: 24,
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            alignItems: "center",
            justifyContent: "space-between"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "rgba(20, 184, 139, 0.1)",
                    border: "1px solid rgba(20, 184, 139, 0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--color-emerald)"
                }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-emerald)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                        Active Global Sprint
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{activeSprint.name}</div>
                    {start && end && (
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                            {activeSprint.startDate} to {activeSprint.endDate} • {daysLeftText}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", gap: 32, alignItems: "center", flex: 1, minWidth: 300, justifyContent: "flex-end" }}>
                {start && end && (
                    <div style={{ flex: 1, maxWidth: 200 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                            <span>Timeline</span>
                            <span>{daysPercent}%</span>
                        </div>
                        <div style={{ height: 6, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${daysPercent}%`, background: "var(--color-sky)", borderRadius: 3 }} />
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, maxWidth: 200 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                        <span>Capacity ({totalPoints}/{capacity} pts)</span>
                        <span style={{ color: totalPoints > capacity ? "#ef4444" : "inherit" }}>
                            {capacity > 0 ? Math.round((totalPoints / capacity) * 100) : 0}%
                        </span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (totalPoints / (capacity || 1)) * 100)}%`, background: totalPoints > capacity ? "#ef4444" : "var(--color-emerald)", borderRadius: 3 }} />
                    </div>
                </div>

                <div style={{ flex: 1, maxWidth: 200 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                        <span>Task Progress</span>
                        <span>{doneTasks}/{totalTasks} done</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-indigo)", borderRadius: 3 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
