"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { SprintContextBar } from "@/components/SprintContextBar";

const COLUMNS = [
    { key: "backlog", label: "Backlog", color: "var(--status-backlog)" },
    { key: "ready", label: "Ready", color: "var(--status-ready)" },
    { key: "in_progress", label: "In Progress", color: "var(--status-in-progress)" },
    { key: "review", label: "Code Review", color: "var(--status-review)" },
    { key: "testing", label: "Testing", color: "var(--status-testing)" },
    { key: "done", label: "Done", color: "var(--status-done)" },
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
    const [newAssigneeId, setNewAssigneeId] = useState("");

    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskToDelete, setTaskToDelete] = useState<any>(null);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        projects: { meetings: {} },
        tasks: {},
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

    // Filter tasks to this project using string ID field
    const projectTasks = filterProject ? allTasks.filter((t: any) => t.projectId === project?.id) : [];

    // Apply sprint filter using string ID field
    const tasks = projectTasks.filter((t: any) => {
        if (selectedSprintFilter === "__all__") return true;
        if (selectedSprintFilter === "__backlog__") return !t.sprintId;
        return t.sprintId === selectedSprintFilter;
    });

    // Capacity calculation for selected sprint
    const sprintCapacity = currentSprint?.capacity || 0;
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

        txs.push(
            db.tx.tasks[taskId].update({
                title: newTitle.trim(),
                description: newDescription.trim(),
                status: addToColumn,
                priority: newPriority,
                createdAt: isEdit ? editingTask.createdAt : Date.now(),
                // Use string ID fields
                projectId: project.id,
                sprintId: (!isEdit && currentSprintId) ? currentSprintId : (isEdit ? editingTask.sprintId || "" : ""),
                assigneeId: newAssigneeId || (isEdit ? editingTask.assigneeId || "" : ""),
            })
        );

        if (!isEdit) {
            const activityId = id();
            txs.push(db.tx.activityLogs[activityId].update({
                action: "Task created manually",
                entityId: taskId,
                entityType: "task",
                createdAt: Date.now()
            }).link({ task: taskId }));
        }

        const oldAssigneeId = isEdit ? editingTask.assigneeId || "" : "";
        if (newAssigneeId !== oldAssigneeId && newAssigneeId) {
            const assignee = profiles.find((p: any) => p.id === newAssigneeId);
            if (assignee) {
                const assignActivityId = id();
                txs.push(db.tx.activityLogs[assignActivityId].update({
                    action: `Assigned to ${assignee.name}`,
                    entityId: taskId,
                    entityType: "task",
                    createdAt: Date.now() + 1
                }).link({ task: taskId }));
            }
        }

        db.transact(txs);
        showToast(isEdit ? "Task updated successfully" : "Task created successfully");
        setNewTitle(""); setNewDescription(""); setNewAssigneeId(""); setEditingTask(null); setShowAddModal(false);
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
                        onClick={() => {
                            if (!filterProject) {
                                showToast("Please select a project first");
                                return;
                            }
                            setEditingTask(null); setNewTitle(""); setNewDescription(""); setNewAssigneeId(""); setAddToColumn("backlog"); setShowAddModal(true);
                        }}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Task
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
                                <div className="kanban-column-header">
                                    <div className="kanban-column-title">
                                        <span className={`status-dot status-dot-${col.key}`} />
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
                                            const assignee = profiles.find((p: any) => p.id === task.assigneeId);
                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`task-card ${draggedTask === task.id ? "dragging" : ""}`}
                                                    draggable
                                                    onDragStart={() => handleDragStart(task.id)}
                                                    onDragEnd={() => { setDraggedTask(null); setDragOverCol(null); }}
                                                    onClick={() => setSelectedTask(task)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <div className="task-card-title">{task.title}</div>
                                                    <div className="task-card-meta">
                                                        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                                                        {assignee && (
                                                            <div className="task-card-assignee" title={assignee.name}>
                                                                <img src={assignee.avatarUrl} alt={assignee.name} style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bg-secondary)" }} />
                                                                <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {assignee.name.split(" ")[0]}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {task.storyPoints && (
                                                            <span style={{ fontSize: 10, fontWeight: 700, background: "var(--bg-primary)", padding: "1px 6px", borderRadius: "100px", color: "var(--text-secondary)" }}>
                                                                {task.storyPoints} pts
                                                            </span>
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
                                <label className="form-label">Assignee</label>
                                <select className="form-select" value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)}>
                                    <option value="">-- Unassigned --</option>
                                    {profiles.map((profile: any) => (<option key={profile.id} value={profile.id}>{profile.name} ({profile.role})</option>))}
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
