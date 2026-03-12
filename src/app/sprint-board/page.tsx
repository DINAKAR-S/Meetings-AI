"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { SprintContextBar } from "@/components/SprintContextBar";

const COLUMNS = [
    { key: "backlog", label: "Backlog", color: "var(--status-backlog)", icon: "⚪" },
    { key: "ready", label: "Ready", color: "var(--status-ready)", icon: "🔵" },
    { key: "in_progress", label: "In Progress", color: "var(--status-in-progress)", icon: "🟡" },
    { key: "review", label: "Code Review", color: "var(--status-review)", icon: "🟣" },
    { key: "testing", label: "Testing", color: "var(--status-testing)", icon: "🟠" },
    { key: "done", label: "Done", color: "var(--status-done)", icon: "🟢" },
];

export default function GlobalSprintBoardPage() {
    const [filterProject, setFilterProject] = useState("");
    const [selectedSprintFilter, setSelectedSprintFilter] = useState<string>("__all__");

    const [draggedTask, setDraggedTask] = useState<string | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addToColumn, setAddToColumn] = useState("backlog");
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newPriority, setNewPriority] = useState("medium");
    const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);

    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskToDelete, setTaskToDelete] = useState<any>(null);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        projects: { meetings: {} },
        tasks: {
            sprint: {},
            assignees: {},
            project: {}
        },
        profiles: {},
        activityLogs: {},
        sprints: {}
    });

    const projects = data?.projects || [];
    const profiles = data?.profiles || [];
    const allActivityLogs = data?.activityLogs || [];
    const allTasks = data?.tasks || [];

    const project = filterProject ? projects.find((p: any) => p.id === filterProject) : null;
    const sprints = data?.sprints || [];

    // Currently selected sprint for filtering
    const currentSprintId = selectedSprintFilter === "__all__"
        ? null
        : selectedSprintFilter === "__backlog__"
            ? null
            : selectedSprintFilter;

    const currentSprint = currentSprintId ? sprints.find((s: any) => s.id === currentSprintId) : null;

    // Filter tasks to this project
    const projectTasks = filterProject ? allTasks.filter((t: any) => t.project?.id === project?.id) : [];

    // Apply sprint filter
    const tasks = projectTasks.filter((t: any) => {
        if (selectedSprintFilter === "__all__") return true;
        if (selectedSprintFilter === "__backlog__") return !t.sprint;
        return t.sprint?.id === selectedSprintFilter;
    });

    // Capacity calculation for selected sprint (sum of all developer capacities)
    const sprintCapacity = profiles.reduce((sum: number, p: any) => sum + (p.capacity || 40), 0);
    const sprintPoints = tasks.reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);

    const handleDragStart = useCallback((taskId: string) => {
        setDraggedTask(taskId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
        e.preventDefault();
        setDragOverCol(colKey);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverCol(null);
    }, []);

    const handleDrop = useCallback(
        (colKey: string) => {
            if (draggedTask) {
                const txs: any[] = [
                    db.tx.tasks[draggedTask].update({ status: colKey })
                ];
                const activityId = id();
                txs.push(db.tx.activityLogs[activityId].update({
                    action: `Moved task to ${colKey.replace("_", " ")}`,
                    entityId: draggedTask,
                    entityType: "task",
                    createdAt: Date.now()
                }).link({ task: draggedTask }));
                db.transact(txs);
            }
            setDraggedTask(null);
            setDragOverCol(null);
        },
        [draggedTask]
    );

    const handleSaveTask = () => {
        if (!newTitle.trim() || !project) return;

        const txs: any[] = [];
        const isEdit = !!editingTask;
        const taskId = isEdit ? editingTask.id : id();

        const updateObj: any = {
            title: newTitle.trim(),
            description: newDescription.trim(),
            status: addToColumn,
            priority: newPriority,
            createdAt: isEdit ? editingTask.createdAt : Date.now(),
        };

        const linkObj: any = {
            project: project.id,
        };

        if (!isEdit && currentSprintId) {
            linkObj.sprint = currentSprintId;
        }

        if (newAssigneeIds.length > 0) {
            // For many-to-many, link adds. To replace on edit, we first unlink existing.
            if (isEdit) {
                const oldAssignees = editingTask.assignees || [];
                oldAssignees.forEach((a: any) => txs.push(db.tx.tasks[taskId].unlink({ assignees: a.id })));
            }
            linkObj.assignees = newAssigneeIds;
        }

        txs.push(db.tx.tasks[taskId].update(updateObj).link(linkObj));

        if (!isEdit) {
            const activityId = id();
            txs.push(db.tx.activityLogs[activityId].update({
                action: "Task created manually",
                entityId: taskId,
                entityType: "task",
                createdAt: Date.now()
            }).link({ task: taskId }));
        }

        const isNewAssignment = isEdit ? newAssigneeIds.some(id => !(editingTask.assignees || []).some((a: any) => a.id === id)) : true;
        if (newAssigneeIds.length > 0 && isNewAssignment) {
            newAssigneeIds.forEach(assigneeId => {
                const assignee = profiles.find((p: any) => p.id === assigneeId);
                if (assignee) {
                    txs.push(db.tx.activityLogs[id()].update({
                        action: `Assigned to ${assignee.name}`,
                        entityId: taskId,
                        entityType: "task",
                        createdAt: Date.now() + 1
                    }).link({ task: taskId }));
                }
            });
        }

        db.transact(txs);
        showToast(isEdit ? "Task updated successfully" : "Task created successfully");
        setNewTitle(""); setNewDescription(""); setNewAssigneeIds([]); setEditingTask(null); setShowAddModal(false);
    };

    const confirmDeleteTask = () => {
        if (!taskToDelete) return;
        const txs: any[] = [];
        const relatedLogs = allActivityLogs.filter((log: any) => log.entityId === taskToDelete.id);
        relatedLogs.forEach((log: any) => txs.push(db.tx.activityLogs[log.id].delete()));
        txs.push(db.tx.tasks[taskToDelete.id].delete());
        db.transact(txs);
        showToast("Task deleted successfully");
        setTaskToDelete(null);
    };

    if (isLoading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <SprintContextBar />

            {/* Context Header */}
            <div style={{
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                padding: "16px", marginBottom: 24, borderRadius: "var(--radius-md)",
                background: "var(--bg-secondary)", border: "1px solid var(--border-light)"
            }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Global Sprint Board
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Project Selector */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>Project:</span>
                            <select
                                className="form-select"
                                style={{ padding: "6px 12px", fontSize: 13, width: 200, background: "var(--bg-primary)" }}
                                value={filterProject}
                                onChange={(e) => {
                                    setFilterProject(e.target.value);
                                    setSelectedSprintFilter("__all__");
                                }}
                            >
                                <option value="">-- Select Project --</option>
                                {projects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {project && (
                    <>
                        <span style={{ color: "var(--border-light)", fontSize: 24, margin: "0 4px" }}>|</span>

                        {/* Sprint Selector */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)" }}>Sprint:</span>
                            <select
                                className="form-select"
                                style={{ padding: "4px 8px", fontSize: 13, width: "auto", background: "var(--bg-primary)" }}
                                value={selectedSprintFilter}
                                onChange={(e) => setSelectedSprintFilter(e.target.value)}
                            >
                                <option value="__all__">All Tasks</option>
                                <option value="__backlog__">Backlog (no sprint)</option>
                                {sprints.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}{s.status === "active" ? " ✓" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {/* Capacity Bar */}
                {currentSprint && sprintCapacity > 0 && (
                    <>
                        <span style={{ color: "var(--border-light)", fontSize: 18, marginLeft: 8 }}>|</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>CAPACITY</span>
                            <div style={{ width: 80, height: 6, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${Math.min(100, (sprintPoints / sprintCapacity) * 100)}%`,
                                    background: sprintPoints > sprintCapacity ? "#ef4444" : "var(--color-emerald)",
                                    borderRadius: 3,
                                    transition: "width 0.3s"
                                }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: sprintPoints > sprintCapacity ? "#ef4444" : "var(--text-secondary)" }}>
                                {sprintPoints}/{sprintCapacity} pts
                            </span>
                        </div>
                    </>
                )}

                <div style={{ marginLeft: "auto" }}>
                    <button
                        className="btn btn-primary"
                        style={{ boxShadow: "0 4px 12px rgba(20, 184, 84, 0.2)" }}
                        onClick={() => {
                            if (!filterProject) {
                                showToast("Please select a project first");
                                return;
                            }
                            setEditingTask(null); setNewTitle(""); setNewDescription(""); setNewAssigneeIds([]); setAddToColumn("backlog"); setShowAddModal(true);
                        }}
                    >
                        ➕ Add Task
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => window.location.href = "/meetings"}
                    >
                        🤖 AI Extract
                    </button>
                </div>
            </div>

            {!project ? (
                <div className="empty-state card">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
                    </svg>
                    <h3>Select a project</h3>
                    <p>Choose a project from the dropdown above to view its sprint board.</p>
                </div>
            ) : (
                <div className="kanban-board">
                    {COLUMNS.map((col) => {
                        const colTasks = tasks.filter((t: any) => t.status === col.key);
                        return (
                            <div
                                className="kanban-column"
                                key={col.key}
                                onDragOver={(e) => handleDragOver(e, col.key)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(col.key)}
                            >
                                <div className="kanban-column-header" style={{ borderTop: `3px solid ${col.color}`, borderBottom: "1px solid var(--border-light)" }}>
                                    <div className="kanban-column-title">
                                        <span style={{ marginRight: 4 }}>{col.icon}</span>
                                        {col.label}
                                        <span className="kanban-column-count">{colTasks.length}</span>
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => { setAddToColumn(col.key); setShowAddModal(true); }}
                                        style={{ width: 24, height: 24, padding: 0, fontSize: 16 }}
                                    >
                                        +
                                    </button>
                                </div>
                                <div className={`kanban-column-body ${dragOverCol === col.key ? "drag-over" : ""}`}>
                                    {colTasks.length === 0 ? (
                                        <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
                                            No tasks
                                        </div>
                                    ) : (
                                        colTasks.map((task: any) => {
                                            const assignee = task.assignedTo;
                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`task-card ${draggedTask === task.id ? "dragging" : ""}`}
                                                    draggable
                                                    onDragStart={() => handleDragStart(task.id)}
                                                    onDragEnd={() => { setDraggedTask(null); setDragOverCol(null); }}
                                                    onClick={() => setSelectedTask(task)}
                                                    style={{
                                                        cursor: "pointer",
                                                        borderLeft: `3px solid var(--priority-${task.priority})`,
                                                        position: "relative"
                                                    }}
                                                    title={`Assignees: ${(task.assignees || []).map((a: any) => a.name).join(", ") || "Unassigned"}\nPriority: ${task.priority}\nPoints: ${task.storyPoints || 0}`}
                                                >
                                                    <div className="task-card-title">{task.title}</div>

                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
                                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                            <span style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 3, color: `var(--priority-${task.priority})` }}>
                                                                {task.priority === "critical" ? "🔥" : task.priority === "high" ? "🟠" : task.priority === "medium" ? "🔵" : "⚪"}
                                                                {task.priority.toUpperCase()}
                                                            </span>
                                                            {task.storyPoints && (
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 3 }}>
                                                                    ⚡ {task.storyPoints}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {task.assignees && task.assignees.length > 0 && (
                                                            <div style={{ display: "flex", flexDirection: "row-reverse" }}>
                                                                {task.assignees.map((a: any, i: number) => {
                                                                    const initials = a.name.split(" ").map((n: string) => n[0]).join("").toUpperCase();
                                                                    return (
                                                                        <div
                                                                            key={a.id}
                                                                            style={{
                                                                                width: 22,
                                                                                height: 22,
                                                                                borderRadius: "50%",
                                                                                background: i % 2 === 0 ? "var(--color-indigo)" : "var(--color-teal)",
                                                                                color: "white",
                                                                                fontSize: 8,
                                                                                fontWeight: 700,
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                justifyContent: "center",
                                                                                border: "2px solid var(--bg-card)",
                                                                                marginLeft: i > 0 ? -8 : 0,
                                                                                zIndex: i,
                                                                                boxShadow: "var(--shadow-sm)"
                                                                            }}
                                                                            title={a.name}
                                                                        >
                                                                            {initials}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal taskId={selectedTask.id} onClose={() => setSelectedTask(null)} />
            )}

            {/* Add/Edit Task Modal */}
            {showAddModal && project && (
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingTask(null); }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingTask ? "Edit Task" : "Add Task"}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowAddModal(false); setEditingTask(null); }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input className="form-input" placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus id="task-title-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" placeholder="Brief description..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select className="form-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Column</label>
                                    <select className="form-select" value={addToColumn} onChange={(e) => setAddToColumn(e.target.value)}>
                                        {COLUMNS.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assignees</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {newAssigneeIds.map(id => {
                                        const p = profiles.find((prof: any) => prof.id === id);
                                        return p ? (
                                            <span key={id} style={{ fontSize: 11, background: "rgba(139, 92, 246, 0.1)", padding: "4px 8px", borderRadius: "100px", border: "1px solid rgba(139, 92, 246, 0.2)", color: "var(--color-indigo)", display: "flex", alignItems: "center", gap: 4 }}>
                                                {p.name}
                                                <button
                                                    type="button"
                                                    onClick={() => setNewAssigneeIds(prev => prev.filter(aid => aid !== id))}
                                                    style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--color-indigo)", fontSize: 10, display: "flex", alignItems: "center", opacity: 0.6 }}
                                                >✕</button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                                <select
                                    className="form-select"
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value && !newAssigneeIds.includes(e.target.value)) {
                                            setNewAssigneeIds([...newAssigneeIds, e.target.value]);
                                        }
                                    }}
                                >
                                    <option value="">+ Add Assignee</option>
                                    {profiles.filter((profile: any) => !newAssigneeIds.includes(profile.id)).map((profile: any) => (
                                        <option key={profile.id} value={profile.id}>{profile.name} ({profile.role})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditingTask(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveTask} id="submit-task-btn">{editingTask ? "Save Changes" : "Add Task"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Task Modal */}
            {taskToDelete && (
                <div className="modal-overlay" onClick={() => setTaskToDelete(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header"><h2 style={{ color: "var(--status-testing)" }}>Delete Task</h2></div>
                        <div className="modal-body" style={{ lineHeight: 1.6 }}>
                            Are you sure you want to delete <strong>{taskToDelete.title}</strong>?<br />
                            This will also remove any activity logs tied to this task.
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setTaskToDelete(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmDeleteTask} style={{ background: "var(--status-testing)" }}>Delete Task</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
