"use client";

import { db } from "@/lib/db";
import { useState, use } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { TaskDetailModal } from "@/components/TaskDetailModal";

const STATUSES = ["backlog", "ready", "in_progress", "review", "testing", "done"];

export default function ProjectBacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const router = useRouter();
    const { showToast } = useToast();

    const [editingTask, setEditingTask] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterSprint, setFilterSprint] = useState("__backlog__");
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [showSprintModal, setShowSprintModal] = useState(false);
    const [selectedSprintId, setSelectedSprintId] = useState("");
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    const { isLoading, data } = db.useQuery({
        projects: {},
        sprints: {},
        tasks: {},
        profiles: {},
        teams: { members: {} }
    });

    const project = data?.projects?.find((p: any) => p.id === projectId);
    const allTasks = (data?.tasks || []).filter((t: any) => t.projectId === projectId);

    // True backlog: tasks not in any sprint
    const tasks = allTasks;

    const profiles = data?.profiles || [];
    const teams = data?.teams || [];
    const sprints = data?.sprints || [];

    const filteredTasks = tasks.filter((t: any) => {
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        if (filterSprint === "__backlog__" && t.sprintId) return false;
        if (filterSprint !== "all" && filterSprint !== "__backlog__" && t.sprintId !== filterSprint) return false;
        return true;
    });

    const totalPoints = tasks.reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);
    const doneTasks = tasks.filter((t: any) => t.status === "done").length;

    const toggleSelectTask = (taskId: string) => {
        const next = new Set(selectedTaskIds);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        setSelectedTaskIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedTaskIds.size === filteredTasks.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id)));
        }
    };

    const handleAssignToSprint = () => {
        if (selectedTaskIds.size === 0 || !selectedSprintId) return;
        const txs = Array.from(selectedTaskIds).map(taskId =>
            db.tx.tasks[taskId].update({ sprintId: selectedSprintId })
        );
        db.transact(txs);
        showToast(`${selectedTaskIds.size} task(s) added to sprint`);
        setSelectedTaskIds(new Set());
        setSelectedSprintId("");
        setShowSprintModal(false);
    };

    const confirmBulkDelete = () => {
        const txs = Array.from(selectedTaskIds).map(taskId => db.tx.tasks[taskId].delete());
        db.transact(txs);
        showToast(`Deleted ${selectedTaskIds.size} tasks`);
        setSelectedTaskIds(new Set());
        setShowBulkDeleteConfirm(false);
    };

    if (isLoading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="card">
                <div className="empty-state">
                    <h3>Project not found</h3>
                    <button className="btn btn-primary" onClick={() => router.push("/projects")}>Go to Projects</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => router.push("/projects")}>← Projects</button>
                    <span style={{ color: "var(--text-tertiary)" }}>/</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{project.name} — Backlog</h2>
                        <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                            <span><strong>{filteredTasks.length}</strong> {filterSprint === '__backlog__' ? 'backlog ' : ''}tasks</span>
                            {filterSprint === '__backlog__' && <span><strong>{allTasks.length - tasks.filter((t: any) => !t.sprintId).length}</strong> in sprints</span>}
                            <span><strong>{doneTasks}</strong> done</span>
                            <span><strong>{totalPoints}</strong> total points</span>
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    {selectedTaskIds.size > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                                {selectedTaskIds.size} selected
                            </span>
                            {sprints.length > 0 && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setShowSprintModal(true)}
                                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                                >
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25" />
                                    </svg>
                                    Add to Sprint
                                </button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ color: "#ef4444", fontSize: 12 }} onClick={() => setShowBulkDeleteConfirm(true)}>
                                Delete
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSelectedTaskIds(new Set())}>
                                ✕ Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button className="btn btn-primary btn-sm" style={{ opacity: 1 }}>Backlog</button>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/sprint-board`)}>Sprint Board</button>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/projects/${projectId}/sprints`)}>Sprints ({sprints.length})</button>
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", alignSelf: "center", marginRight: 4 }}>Status:</span>
                <button className={`filter-chip ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>All</button>
                {STATUSES.map(s => (
                    <button key={s} className={`filter-chip ${filterStatus === s ? "active" : ""}`} onClick={() => setFilterStatus(s)}>
                        {s.replace("_", " ")}
                    </button>
                ))}

                <div style={{ width: 1, height: 20, background: "var(--border-light)", alignSelf: "center", marginLeft: 8, marginRight: 8 }} />

                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", alignSelf: "center", marginRight: 4 }}>Sprint:</span>
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterSprint} onChange={(e) => setFilterSprint(e.target.value)}>
                    <option value="all">All Tasks</option>
                    <option value="__backlog__">Backlog (no sprint)</option>
                    {sprints.map((s: any) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
            </div>

            {/* Tasks */}
            <div className="card" style={{ overflow: "hidden" }}>
                {filteredTasks.length === 0 ? (
                    <div className="empty-state">
                        <h3>No tasks found</h3>
                        <p>
                            {tasks.length === 0
                                ? "No tasks exist yet! Use Meeting Intelligence to generate tasks, or create tasks in the Sprint Board."
                                : "Adjust your filters to see results."}
                        </p>
                        {tasks.length === 0 && sprints.length > 0 && (
                            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => router.push(`/sprint-board`)}>
                                View Sprint Board
                            </button>
                        )}
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <th style={{ width: 36, padding: "10px 12px" }}>
                                    <input type="checkbox"
                                        checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                                        onChange={toggleSelectAll}
                                        style={{ cursor: "pointer" }} />
                                </th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Status</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Title</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Priority</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Assignee</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Team</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Pts</th>
                                <th style={{ textAlign: "right", padding: "10px 12px" }} />
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map((task: any) => (
                                <tr
                                    key={task.id}
                                    style={{
                                        borderBottom: "1px solid var(--border-light)",
                                        transition: "background 0.1s",
                                        background: selectedTaskIds.has(task.id) ? "rgba(var(--color-primary-rgb), 0.05)" : "transparent"
                                    }}
                                    onMouseOver={(e) => { if (!selectedTaskIds.has(task.id)) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                                    onMouseOut={(e) => { if (!selectedTaskIds.has(task.id)) e.currentTarget.style.background = "transparent"; }}
                                >
                                    <td style={{ padding: "10px 12px" }}>
                                        <input type="checkbox" checked={selectedTaskIds.has(task.id)} onChange={() => toggleSelectTask(task.id)} style={{ cursor: "pointer" }} />
                                    </td>
                                    <td style={{ padding: "10px 12px" }}><span className={`badge badge-${task.status}`}>{task.status.replace("_", " ")}</span></td>
                                    <td style={{ padding: "10px 12px", fontWeight: 500, cursor: "pointer" }} onClick={() => setEditingTask(task)}>{task.title}</td>
                                    <td style={{ padding: "10px 12px" }}><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                                    <td style={{ padding: "10px 12px" }}>
                                        {(() => {
                                            const assignee = profiles.find((p: any) => p.id === task.assigneeId);
                                            return assignee ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <img src={assignee.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />
                                                    <span style={{ fontSize: 12 }}>{assignee.name}</span>
                                                </div>
                                            ) : (<span style={{ color: "var(--text-tertiary)" }}>—</span>);
                                        })()}
                                    </td>
                                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                                        {(() => {
                                            const team = teams.find((t: any) => t.id === task.teamId);
                                            return team ? (
                                                <span className="badge" style={{ fontSize: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>{team.name}</span>
                                            ) : (<span style={{ color: "var(--text-tertiary)" }}>—</span>);
                                        })()}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{task.storyPoints || "—"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingTask(task)}>Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Task Modal */}
            {editingTask && (
                <TaskDetailModal taskId={editingTask.id} onClose={() => setEditingTask(null)} />
            )}

            {/* Add to Sprint Modal */}
            {showSprintModal && (
                <div className="modal-overlay" onClick={() => setShowSprintModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>Add to Sprint</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowSprintModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                                Moving <strong>{selectedTaskIds.size} task(s)</strong> from <strong>{project.name}</strong> backlog into a sprint.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Select Sprint</label>
                                <select
                                    className="form-select"
                                    value={selectedSprintId}
                                    onChange={(e) => setSelectedSprintId(e.target.value)}
                                    autoFocus
                                >
                                    <option value="">— Choose a sprint —</option>
                                    {sprints.map((s: any) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}{s.startDate ? ` • ${s.startDate} → ${s.endDate}` : ""}
                                            {s.capacity ? ` (${s.capacity} pts)` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSprintModal(false)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAssignToSprint}
                                disabled={!selectedSprintId}
                                style={{ opacity: selectedSprintId ? 1 : 0.6 }}
                            >
                                Add to Sprint
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation */}
            {showBulkDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowBulkDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header"><h2 style={{ color: "#ef4444" }}>Bulk Delete Tasks</h2></div>
                        <div className="modal-body" style={{ lineHeight: 1.6 }}>
                            Are you sure you want to delete <strong>{selectedTaskIds.size} tasks</strong>?<br />This action cannot be undone.
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmBulkDelete} style={{ background: "#ef4444", borderColor: "#ef4444" }}>Delete {selectedTaskIds.size} Tasks</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
