"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { SprintContextBar } from "@/components/SprintContextBar";
import { AiSprintPlannerBoard } from "@/components/AiSprintPlannerBoard";

const PRIORITIES = ["all", "critical", "high", "medium", "low"];
const STATUSES = ["all", "backlog", "ready", "in_progress", "review", "testing", "done"];

export default function BacklogPage() {
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterAssignee, setFilterAssignee] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterSprint, setFilterSprint] = useState("__backlog__");
    const [filterTeam, setFilterTeam] = useState("");

    // Sprint assignment
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [showSprintModal, setShowSprintModal] = useState(false);
    const [selectedSprintId, setSelectedSprintId] = useState("");
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    // AI Planner State
    const [showAiPlanModal, setShowAiPlanModal] = useState(false);
    const [isPlanning, setIsPlanning] = useState(false);
    const [aiPlanResult, setAiPlanResult] = useState<any>(null);

    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskToDelete, setTaskToDelete] = useState<any>(null);

    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        tasks: {
            sprint: {},
            assignees: {},
            project: {},
            assignedTeam: {}
        },
        profiles: {},
        projects: {},
        teams: { members: {} },
        sprints: {},
    });

    const allTasks = data?.tasks || [];
    const profiles = data?.profiles || [];
    const projects = data?.projects || [];
    const teams = data?.teams || [];
    const sprints = data?.sprints || [];

    // All tasks to process
    const tasks = allTasks;

    // Get team members for filtered assignee dropdown
    const getTeamMembers = (teamId: string) => {
        if (!teamId) return profiles;
        const team = teams.find(t => t.id === teamId);
        return team?.members || profiles;
    };

    // Since Sprints are global, they are all available
    const availableSprints = sprints;

    const handleDeleteTask = (task: any) => {
        setTaskToDelete(task);
    };

    const confirmDeleteTask = () => {
        if (!taskToDelete) return;
        db.transact(db.tx.tasks[taskToDelete.id].delete());
        showToast("Task deleted successfully");
        setTaskToDelete(null);
        setEditingTask(null);
    };

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
            setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
        }
    };

    const handleAssignToSprint = () => {
        if (selectedTaskIds.size === 0 || !selectedSprintId) return;
        const txs = Array.from(selectedTaskIds).map(taskId =>
            db.tx.tasks[taskId].link({ sprint: selectedSprintId })
        );
        db.transact(txs);
        showToast(`${selectedTaskIds.size} task(s) added to sprint`);
        setSelectedTaskIds(new Set());
        setSelectedSprintId("");
        setShowSprintModal(false);
    };

    const handleBulkDelete = () => {
        if (selectedTaskIds.size === 0) return;
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = () => {
        const txs = Array.from(selectedTaskIds).map(taskId => db.tx.tasks[taskId].delete());
        db.transact(txs);
        showToast(`Deleted ${selectedTaskIds.size} tasks`);
        setSelectedTaskIds(new Set());
        setShowBulkDeleteConfirm(false);
    };

    const handleUpdateAssignee = (taskId: string, profileId: string) => {
        if (!profileId) return;
        db.transact(db.tx.tasks[taskId].link({ assignees: profileId }));
        showToast("Assignee updated");
    };

    const handleAcceptAiPlan = (finalAssignments: { taskId: string; assigneeId: string }[]) => {
        if (!selectedSprintId) return;

        const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const txs: any[] = [];
        for (const assignment of finalAssignments) {
            const taskId = assignment.taskId;
            const assigneeId = assignment.assigneeId;

            // Only transact if IDs are valid UUIDs
            if (isUuid(taskId)) {
                const txObj = db.tx.tasks[taskId].link({
                    sprint: selectedSprintId,
                });

                if (assigneeId && isUuid(assigneeId)) {
                    txObj.link({ assignees: assigneeId });
                }

                txs.push(txObj);

                const logId = id();
                txs.push(db.tx.activityLogs[logId].update({
                    action: "Assigned via AI Interactive Planner",
                    entityId: taskId,
                    entityType: "task",
                    createdAt: Date.now()
                }).link({ task: taskId }));
            }
        }

        if (txs.length > 0) {
            db.transact(txs);
            showToast(`Sprint Plan applied (${txs.filter(t => t.action === "update" || t.op === "link").length} updates)`);
        }
        setShowAiPlanModal(false);
        setAiPlanResult(null);
    };

    const filteredTasks = tasks.filter((t: any) => {
        if (filterPriority !== "all" && t.priority !== filterPriority) return false;
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        if (filterAssignee && !t.assignees?.some((a: any) => a.id === filterAssignee)) return false;
        if (filterProject && t.project?.id !== filterProject) return false;
        if (filterTeam && t.assignedTeam?.id !== filterTeam) return false;
        if (filterSprint === "__backlog__" && t.sprint) return false;
        if (filterSprint !== "all" && filterSprint !== "__backlog__" && t.sprint?.id !== filterSprint) return false;
        return true;
    });

    if (isLoading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Backlog</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        {filterSprint === "__backlog__"
                            ? `Tasks not yet assigned to a sprint — ${filteredTasks.length} tasks`
                            : filterSprint === "all"
                                ? `Showing all tasks — ${filteredTasks.length} tasks`
                                : `Sprint tasks — ${filteredTasks.length} tasks`}
                    </p>
                </div>

                <div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSelectedSprintId("");
                            setAiPlanResult(null);
                            setShowAiPlanModal(true);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139, 92, 246, 0.1)", color: "var(--color-indigo)", border: "1px solid rgba(139, 92, 246, 0.2)" }}
                    >
                        ✨ Generate Sprint Plan
                    </button>
                </div>

                {/* Bulk Actions Bar */}
                {selectedTaskIds.size > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                            {selectedTaskIds.size} selected
                        </span>
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
                        <button className="btn btn-ghost btn-sm" style={{ color: "#ef4444", fontSize: 12 }} onClick={handleBulkDelete}>
                            Delete
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSelectedTaskIds(new Set())}>
                            ✕ Clear
                        </button>
                    </div>
                )}
            </div>

            <SprintContextBar />

            {/* Filters */}
            <div className="filter-bar" style={{ flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Priority:</span>
                {PRIORITIES.map((p) => (
                    <button key={p} className={`filter-chip ${filterPriority === p ? "active" : ""}`} onClick={() => setFilterPriority(p)}>
                        {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
                <div style={{ width: 1, height: 20, background: "var(--border-light)" }} />
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    {STATUSES.map((s) => (<option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ")}</option>))}
                </select>
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                    <option value="">All Projects</option>
                    {projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterSprint} onChange={(e) => setFilterSprint(e.target.value)}>
                    <option value="all">All Tasks</option>
                    <option value="__backlog__">Backlog (no sprint)</option>
                    {availableSprints.map((s: any) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
                    <option value="">All Teams</option>
                    {teams.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
                    <option value="">All Assignees</option>
                    {profiles.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
                Showing {filteredTasks.length} tasks
                {filterSprint === "__backlog__" && (
                    <span style={{ marginLeft: 8, color: "var(--color-emerald)", fontWeight: 600 }}>
                        • {tasks.filter((t: any) => t.sprint).length} tasks in sprints
                    </span>
                )}
            </div>

            {/* Task Table */}
            <div className="card" style={{ overflow: "hidden" }}>
                {filteredTasks.length === 0 ? (
                    <div className="empty-state">
                        <h3>No tasks found</h3>
                        <p>{tasks.length === 0 ? "No tasks exist yet. Create tasks from Meetings." : "Adjust your filters to see results."}</p>
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <th style={{ width: 36, padding: "10px 12px" }}>
                                    <input type="checkbox" checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
                                </th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Title</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Priority</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignee</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Team</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Project</th>
                                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pts</th>
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
                                    <td style={{ padding: "10px 12px" }}>
                                        <span className={`badge badge-${task.status}`}>{task.status.replace("_", " ")}</span>
                                    </td>
                                    <td style={{ padding: "10px 12px", fontWeight: 500, cursor: "pointer" }} onClick={() => setEditingTask(task)}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {task.title}
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            {task.assignees && task.assignees.length > 0 && (
                                                <div style={{ display: "flex" }}>
                                                    {task.assignees.map((a: any, i: number) => (
                                                        <img key={a.id} src={a.avatarUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${a.name}`} title={a.name} alt={a.name} style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--bg-primary)", marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }} />
                                                    ))}
                                                </div>
                                            )}
                                            <select
                                                className="form-select"
                                                style={{ width: "auto", padding: "2px 4px", fontSize: 11, border: "none", background: "transparent", color: "var(--color-indigo)", cursor: "pointer" }}
                                                value=""
                                                onChange={(e) => handleUpdateAssignee(task.id, e.target.value)}
                                            >
                                                <option value="">+</option>
                                                {profiles.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                                        {task.assignedTeam ? (
                                            <span className="badge" style={{ fontSize: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>{task.assignedTeam.name}</span>
                                        ) : (
                                            <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                                        {task.project ? (
                                            <span className="badge badge-medium" style={{ fontSize: 10 }}>{task.project.name}</span>
                                        ) : (
                                            <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                                        {task.storyPoints || "—"}
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}>Edit</button>
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
                                Adding <strong>{selectedTaskIds.size} task(s)</strong> to a sprint. They will be removed from this backlog view.
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
                                            {s.name}
                                            {s.startDate ? ` • ${s.startDate} → ${s.endDate}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {availableSprints.length === 0 && (
                                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                                    No sprints found. Create a sprint under Projects first.
                                </div>
                            )}
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

            {/* Delete Confirmation */}
            {taskToDelete && (
                <div className="modal-overlay" onClick={() => setTaskToDelete(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header"><h2 style={{ color: "#ef4444" }}>Delete Task</h2></div>
                        <div className="modal-body" style={{ lineHeight: 1.6 }}>
                            Are you sure you want to delete <strong>{taskToDelete.title}</strong>?<br />This action cannot be undone.
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setTaskToDelete(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmDeleteTask} style={{ background: "#ef4444", borderColor: "#ef4444" }}>Delete Task</button>
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

            {/* AI Sprint Planner Modal */}
            {showAiPlanModal && (
                <div className="modal-overlay" onClick={() => { if (!isPlanning) setShowAiPlanModal(false); }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1200, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-indigo)" }}>
                                    ✨ AI Sprint Planner
                                </h2>
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                                    Let AI analyze your backlog and developer capacities to suggest an optimal sprint plan.
                                </p>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAiPlanModal(false)} disabled={isPlanning}>✕</button>
                        </div>

                        <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
                            {!aiPlanResult && !isPlanning && (
                                <div style={{ marginBottom: 24 }}>
                                    <label className="form-label">1. Select Target Sprint</label>
                                    <select
                                        className="form-select"
                                        value={selectedSprintId}
                                        onChange={(e) => setSelectedSprintId(e.target.value)}
                                        style={{ maxWidth: 400 }}
                                    >
                                        <option value="">— Choose a sprint —</option>
                                        {availableSprints.map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} (Capacity: {s.capacity || 0} pts)
                                            </option>
                                        ))}
                                    </select>
                                    {availableSprints.length === 0 && (
                                        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                                            No sprints found. Create a sprint under Global Sprints first.
                                        </p>
                                    )}
                                </div>
                            )}

                            {isPlanning && (
                                <div style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                                    <div className="spinner" style={{ width: 32, height: 32, borderTopColor: "var(--color-indigo)" }} />
                                    <div style={{ color: "var(--color-indigo)", fontWeight: 600 }}>Analyzing backlog and developer profiles...</div>
                                </div>
                            )}

                            {aiPlanResult && (
                                <AiSprintPlannerBoard
                                    tasks={tasks}
                                    profiles={profiles}
                                    initialAssignments={aiPlanResult.assignments || []}
                                    initialUnassignedIds={aiPlanResult.unassignedTaskIds || []}
                                    sprintCapacity={sprints.find((s: any) => s.id === selectedSprintId)?.capacity || 0}
                                    onApply={handleAcceptAiPlan}
                                    onCancel={() => setAiPlanResult(null)}
                                />
                            )}
                        </div>

                        {!aiPlanResult && (
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowAiPlanModal(false)} disabled={isPlanning}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={async () => {
                                        if (!selectedSprintId) {
                                            showToast("Please select a target sprint first.");
                                            return;
                                        }

                                        const sprint = sprints.find((s: any) => s.id === selectedSprintId);
                                        if (!sprint) return;

                                        setIsPlanning(true);
                                        setAiPlanResult(null);

                                        try {
                                            const backlogTasks = tasks.filter((t: any) => !t.sprint);
                                            const response = await fetch("/api/sprints/plan", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    backlogTasks,
                                                    profiles,
                                                    activeSprintCapacity: sprint.capacity || 0
                                                })
                                            });
                                            const res = await response.json();
                                            if (res.success) {
                                                setAiPlanResult(res.data);
                                                showToast("AI Sprint Plan generated!");
                                            } else {
                                                showToast(res.error || "Failed to generate plan");
                                            }
                                        } catch (err: any) {
                                            showToast(err.message || "Failed to generate plan");
                                        } finally {
                                            setIsPlanning(false);
                                        }
                                    }}
                                    disabled={!selectedSprintId || isPlanning || availableSprints.length === 0}
                                    style={{ background: "var(--color-indigo)", borderColor: "var(--color-indigo)" }}
                                >
                                    {isPlanning ? "Analyzing..." : "Generate Plan"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
