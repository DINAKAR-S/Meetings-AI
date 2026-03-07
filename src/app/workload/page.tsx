"use client";

import { db } from "@/lib/db";
import { useState } from "react";
import { SprintContextBar } from "@/components/SprintContextBar";

const COLORS = [
    "linear-gradient(90deg, var(--color-lime), var(--color-green))",
    "linear-gradient(90deg, var(--color-emerald), var(--color-teal))",
    "linear-gradient(90deg, var(--color-cyan), var(--color-sky))",
    "linear-gradient(90deg, var(--color-sky), var(--color-deep-blue))",
    "linear-gradient(90deg, var(--color-deep-blue), var(--color-royal))",
    "linear-gradient(90deg, var(--color-teal), var(--color-cyan))",
];

export default function WorkloadPage() {
    const [filterProject, setFilterProject] = useState("");
    const [filterSprint, setFilterSprint] = useState("");

    const { isLoading, data } = db.useQuery({
        tasks: {},
        profiles: {},
        projects: {},
        sprints: {},
    });

    if (isLoading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    const tasks = data?.tasks || [];
    const profiles = data?.profiles || [];
    const projects = data?.projects || [];
    const sprints = data?.sprints || [];

    // Sprints are global, so all are available
    const projectSprints = sprints;

    // Filter tasks by project and sprint
    const filteredTasks = tasks.filter((t: any) => {
        if (filterProject && t.projectId !== filterProject) return false;
        if (filterSprint === "__backlog__" && t.sprintId) return false;
        if (filterSprint && filterSprint !== "__backlog__" && filterSprint !== "all" && t.sprintId !== filterSprint) return false;
        return true;
    });

    // Per-dev filtered tasks
    const filteredProfiles = profiles.map((profile: any) => {
        const devTasks = filteredTasks.filter((t: any) => t.assigneeId === profile.id);
        return { ...profile, filteredTasks: devTasks };
    }).sort((a: any, b: any) => (b.filteredTasks?.length || 0) - (a.filteredTasks?.length || 0));

    const unassignedTasks = filteredTasks.filter((t: any) => !t.assigneeId);
    const activeSprintName = filterSprint ? sprints.find((s: any) => s.id === filterSprint)?.name : null;

    return (
        <div>
            <SprintContextBar />

            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Developer Workload</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                    Task distribution and capacity planning across team members
                </p>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Filter by:</span>
                <select
                    className="form-select"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
                    value={filterProject}
                    onChange={(e) => { setFilterProject(e.target.value); setFilterSprint(""); }}
                >
                    <option value="">All Projects</option>
                    {projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <select
                    className="form-select"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
                    value={filterSprint}
                    onChange={(e) => setFilterSprint(e.target.value)}
                >
                    <option value="">All Sprints</option>
                    <option value="__backlog__">Backlog (no sprint)</option>
                    {projectSprints.map((s: any) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                {(filterProject || filterSprint) && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => { setFilterProject(""); setFilterSprint(""); }}>
                        ✕ Clear filters
                    </button>
                )}
                {activeSprintName && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-emerald)" }}>
                        Viewing: {activeSprintName}
                    </span>
                )}
            </div>

            {/* Summary metrics */}
            <div className="metrics-grid" style={{ marginBottom: 24 }}>
                <div className="metric-card">
                    <div className="metric-card-label">Team Members</div>
                    <div className="metric-card-value">{profiles.length}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-card-label">{filterSprint || filterProject ? "Filtered Tasks" : "Total Tasks"}</div>
                    <div className="metric-card-value">{filteredTasks.length}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-card-label">Avg per Developer</div>
                    <div className="metric-card-value">
                        {profiles.length > 0
                            ? Math.round((filteredTasks.length - unassignedTasks.length) / profiles.length)
                            : 0}
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-card-label">Unassigned</div>
                    <div className="metric-card-value">{unassignedTasks.length}</div>
                </div>
            </div>

            {profiles.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <h3>No team members yet</h3>
                        <p>Go to the Teams page to add developers to track their workload.</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-header">
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Workload Distribution</span>
                        {(filterProject || filterSprint) && (
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                                Filtered view — {filteredTasks.length} tasks shown
                            </span>
                        )}
                    </div>
                    <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {filteredProfiles.map((profile: any, idx: number) => {
                            const devTasks = profile.filteredTasks || [];
                            const done = devTasks.filter((t: any) => t.status === "done").length;
                            const inProgress = devTasks.filter((t: any) => t.status === "in_progress").length;
                            const critical = devTasks.filter((t: any) => t.priority === "critical").length;

                            const assignedPoints = devTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 3), 0);
                            const percentCapacity = profile.capacity > 0
                                ? Math.min(100, Math.round((assignedPoints / profile.capacity) * 100))
                                : 0;

                            return (
                                <div key={profile.id} className="workload-bar">
                                    <div className="workload-name" style={{ minWidth: 200 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <img
                                                src={profile.avatarUrl}
                                                alt={profile.name}
                                                style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-secondary)", flexShrink: 0 }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{profile.name}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                                    {devTasks.length} total • {done} done • {inProgress} active
                                                    {critical > 0 && <span style={{ color: "#ef4444" }}> • {critical} critical</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, padding: "0 16px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                                            <span>Capacity</span>
                                            <span>{assignedPoints} / {profile.capacity || "?"} pts</span>
                                        </div>
                                        <div className="workload-track" style={{ height: 8 }}>
                                            <div
                                                className="workload-fill"
                                                style={{
                                                    width: `${percentCapacity}%`,
                                                    background: percentCapacity > 90 ? "#ef4444" : COLORS[idx % COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Detailed breakdown per dev */}
            {filteredProfiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
                    {filteredProfiles.map((profile: any) => {
                        const devTasks = profile.filteredTasks || [];

                        const highWip = devTasks.filter((t: any) => t.status === "in_progress").length > 3;
                        const hasCritical = devTasks.filter((t: any) => t.priority === "critical").length > 0;
                        const assignedPoints = devTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 3), 0);
                        const overCapacity = profile.capacity ? assignedPoints > profile.capacity : false;

                        return (
                            <div className="card" key={profile.id} style={{ display: "flex", flexDirection: "column" }}>
                                <div className="card-header" style={{ alignItems: "flex-start" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <img
                                            src={profile.avatarUrl}
                                            alt={profile.name}
                                            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}
                                        />
                                        <div>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{profile.name}</span>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{profile.role}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body" style={{ padding: 0, flex: 1 }}>
                                    {devTasks.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>
                                            {filterSprint || filterProject ? "No tasks in this filter." : "No tasks assigned."}
                                        </div>
                                    ) : (
                                        <>
                                            {devTasks.slice(0, 5).map((task: any) => (
                                                <div
                                                    key={task.id}
                                                    style={{
                                                        padding: "10px 16px",
                                                        borderBottom: "1px solid var(--border-light)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        fontSize: 12.5,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                                                        <span className={`status-dot status-dot-${task.status}`} style={{ flexShrink: 0 }} />
                                                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
                                                    </div>
                                                    <span className={`badge badge-${task.priority}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                                                        {task.priority}
                                                    </span>
                                                </div>
                                            ))}
                                            {devTasks.length > 5 && (
                                                <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", background: "var(--bg-secondary)" }}>
                                                    + {devTasks.length - 5} more tasks
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {(highWip || overCapacity || hasCritical) && (
                                    <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.05)", borderTop: "1px solid var(--border-light)", borderBottomLeftRadius: "var(--radius-lg)", borderBottomRightRadius: "var(--radius-lg)" }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginBottom: 4, display: "flex", gap: 4, alignItems: "center" }}>
                                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            AI Recommendation
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                            {overCapacity && `${profile.name} may be overloaded. `}
                                            {highWip && `Too many tasks in progress. `}
                                            {hasCritical && `Critical tasks pending.`}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
