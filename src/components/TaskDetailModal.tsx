"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

const STATUSES = ["backlog", "ready", "in_progress", "review", "testing", "done"];
const PRIORITIES = ["critical", "high", "medium", "low"];

export function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
    const { showToast } = useToast();

    // Query everything related to this task and all reference data needed for selectors
    const { isLoading, data } = db.useQuery({
        tasks: {
            $: { where: { id: taskId } },
            assigneeProfile: {},
            assigneeTeam: {},
            project: {},
            story: { epic: {} },
            subtasks: {},
            comments: { author: {} },
            activityLogs: {},
        },
        profiles: {},
        teams: { members: {} },
        projects: {},
        stories: {},
    });

    const task = data?.tasks?.[0] as any;
    const profiles = data?.profiles || [];
    const teams = data?.teams || [];
    const projects = data?.projects || [];
    const stories = data?.stories || [];

    // Local mutable state for debounced saves
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [newSubtask, setNewSubtask] = useState("");
    const [newComment, setNewComment] = useState("");

    // Initialize local state once data loads
    useEffect(() => {
        if (task) {
            setTitle(task.title || "");
            setDescription(task.description || "");
        }
    }, [task?.title, task?.description]);

    const handleSaveBasic = () => {
        if (!task) return;
        db.transact(db.tx.tasks[task.id].update({
            title,
            description,
        }));
        showToast("Task saved");
    };

    const handleUpdateField = (field: string, value: any) => {
        if (!task) return;
        db.transact(db.tx.tasks[task.id].update({ [field]: value }));

        // Log activity
        const logId = id();
        db.transact(db.tx.activityLogs[logId].update({
            action: `Updated ${field} to ${value}`,
            entityType: "task",
            entityId: task.id,
            createdAt: Date.now()
        }).link({ task: task.id }));
    };

    // Use direct string ID fields instead of InstantDB links to avoid stale unique constraints
    const handleUpdateRelation = (fieldName: "assigneeId" | "teamId" | "projectId" | "storyId", currentValue: string, newValue: string) => {
        if (!task || currentValue === newValue) return;

        console.log(`[TaskDetailModal] Updating ${fieldName}: "${currentValue}" → "${newValue}"`);

        const txs: any[] = [
            db.tx.tasks[task.id].update({ [fieldName]: newValue || "" })
        ];

        const logId = id();
        const labelMap: Record<string, string> = {
            assigneeId: "assignee",
            teamId: "team",
            projectId: "project",
            storyId: "story",
        };
        const actionText = newValue ? `Updated ${labelMap[fieldName]}` : `Cleared ${labelMap[fieldName]}`;
        txs.push(db.tx.activityLogs[logId].update({
            action: actionText,
            entityType: "task",
            entityId: task.id,
            createdAt: Date.now()
        }).link({ task: task.id }));

        db.transact(txs);
    };

    const handleAddSubtask = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && newSubtask.trim() && task) {
            const subId = id();
            db.transact([
                db.tx.subtasks[subId].update({
                    title: newSubtask.trim(),
                    done: false,
                    createdAt: Date.now()
                }).link({ task: task.id }),
                db.tx.activityLogs[id()].update({
                    action: `Added subtask: ${newSubtask.trim()}`,
                    entityType: "task",
                    entityId: task.id,
                    createdAt: Date.now()
                }).link({ task: task.id })
            ]);
            setNewSubtask("");
        }
    };

    const handleToggleSubtask = (subId: string, currentStatus: boolean) => {
        db.transact(db.tx.subtasks[subId].update({ done: !currentStatus }));
    };

    const handleDeleteSubtask = (subId: string) => {
        db.transact(db.tx.subtasks[subId].delete());
    };

    const handleAddComment = () => {
        if (!newComment.trim() || !task) return;

        // Assuming current user is standard (mocking as first profile or dynamic if auth existed)
        const me = profiles.length > 0 ? profiles[0] : null;

        const commentId = id();
        const txs: any[] = [
            db.tx.comments[commentId].update({
                message: newComment.trim(),
                createdAt: Date.now()
            }).link({ task: task.id })
        ];

        if (me) {
            txs.push(db.tx.comments[commentId].link({ author: me.id }));
        }

        db.transact(txs);
        setNewComment("");
    };

    if (isLoading) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" style={{ maxWidth: 800, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (!task) return null;

    // Read relationship IDs directly from string fields
    const currentAssignee = task.assigneeId || "";
    const currentTeam = task.teamId || "";
    const currentProject = task.projectId || "";
    const currentStory = task.storyId || "";

    // Look up display names from the loaded lists
    const projectObj = projects.find((p: any) => p.id === currentProject);
    const storyObj = stories.find((s: any) => s.id === currentStory);

    const breadcrumbs = [
        projectObj?.name || "Unassigned Project",
        storyObj?.title || null,
        task.title
    ].filter(Boolean);

    const sortedSubtasks = [...(task.subtasks || [])].sort((a, b) => a.createdAt - b.createdAt);
    const sortedComments = [...(task.comments || [])].sort((a, b) => b.createdAt - a.createdAt); // newest first
    const sortedLogs = [...(task.activityLogs || [])].sort((a, b) => b.createdAt - a.createdAt);

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, padding: "20px" }}>
            <div
                className="modal"
                style={{
                    maxWidth: 1000,
                    width: "100%",
                    height: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "12px",
                    overflow: "hidden"
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Breadcrumbs & Actions */}
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
                        {breadcrumbs.map((bc, i) => (
                            <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: i === breadcrumbs.length - 1 ? "var(--text-primary)" : "inherit", fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>{bc}</span>
                                {i < breadcrumbs.length - 1 && <span>/</span>}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <button className="btn btn-ghost" style={{ color: "#ef4444", fontSize: 13 }} onClick={() => {
                            if (confirm("Delete this task?")) {
                                db.transact(db.tx.tasks[task.id].delete());
                                onClose();
                            }
                        }}>
                            Delete
                        </button>
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Main Content: Left/Right Split */}
                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                    {/* LEFT COLUMN: Title, Desc, Subtasks, Activity */}
                    <div style={{ flex: 2, padding: "24px", overflowY: "auto", borderRight: "1px solid var(--border-light)" }}>
                        <input
                            style={{ fontSize: 24, fontWeight: 700, width: "100%", border: "none", background: "transparent", outline: "none", marginBottom: 16 }}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleSaveBasic}
                            placeholder="Task title"
                        />

                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Description</div>
                            <textarea
                                style={{
                                    width: "100%",
                                    minHeight: 100,
                                    padding: 12,
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "var(--radius-md)",
                                    outline: "none",
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                    fontSize: 14
                                }}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={handleSaveBasic}
                                placeholder="Add a description..."
                            />
                        </div>

                        {/* SUBTASKS */}
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Subtasks</span>
                                <span style={{ fontSize: 12, fontWeight: 400 }}>{sortedSubtasks.filter(s => s.done).length} / {sortedSubtasks.length} done</span>
                            </div>

                            {/* Subtask Progress */}
                            {sortedSubtasks.length > 0 && (
                                <div style={{ height: 6, background: "var(--bg-secondary)", borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
                                    <div style={{ height: "100%", background: "var(--color-green)", width: `${(sortedSubtasks.filter(s => s.done).length / sortedSubtasks.length) * 100}%`, transition: "width 0.3s" }} />
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {sortedSubtasks.map(sub => (
                                    <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--bg-primary)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
                                        <input
                                            type="checkbox"
                                            checked={sub.done}
                                            onChange={() => handleToggleSubtask(sub.id, sub.done)}
                                            style={{ width: 16, height: 16, cursor: "pointer" }}
                                        />
                                        <span style={{ flex: 1, fontSize: 14, textDecoration: sub.done ? "line-through" : "none", color: sub.done ? "var(--text-tertiary)" : "inherit" }}>
                                            {sub.title}
                                        </span>
                                        <button className="btn btn-ghost btn-sm" style={{ padding: 4, height: "auto" }} onClick={() => handleDeleteSubtask(sub.id)}>✕</button>
                                    </div>
                                ))}
                                <input
                                    style={{ padding: "8px 12px", background: "var(--bg-secondary)", border: "1px dashed var(--border-light)", borderRadius: "var(--radius-md)", fontSize: 14, outline: "none" }}
                                    placeholder="+ Create a subtask (press Enter)"
                                    value={newSubtask}
                                    onChange={(e) => setNewSubtask(e.target.value)}
                                    onKeyDown={handleAddSubtask}
                                />
                            </div>
                        </div>

                        {/* COMMENTS */}
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)" }}>Comments</div>

                            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                                <img src={profiles[0]?.avatarUrl || "https://api.dicebear.com/9.x/initials/svg?seed=Me"} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <textarea
                                        style={{ width: "100%", minHeight: 60, padding: 12, background: "var(--bg-primary)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", outline: "none", resize: "vertical", fontSize: 14 }}
                                        placeholder="Add a comment..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                    />
                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                        <button className="btn btn-primary btn-sm" onClick={handleAddComment} disabled={!newComment.trim()}>Save</button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                {sortedComments.map(comment => {
                                    const author = comment.author?.[0];
                                    const date = new Date(comment.createdAt).toLocaleString();
                                    return (
                                        <div key={comment.id} style={{ display: "flex", gap: 12 }}>
                                            <img src={author?.avatarUrl || "https://api.dicebear.com/9.x/initials/svg?seed=User"} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                                            <div>
                                                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{author?.name || "Unknown"}</span>
                                                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{date}</span>
                                                </div>
                                                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                                                    {comment.message}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Metadata / Details */}
                    <div style={{ flex: 1, minWidth: 280, padding: "24px", background: "var(--bg-primary)", overflowY: "auto" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                            {/* STATUS */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Status</label>
                                <select
                                    className="form-select"
                                    value={task.status}
                                    onChange={(e) => handleUpdateField("status", e.target.value)}
                                    style={{ background: "var(--bg-secondary)", fontWeight: 500 }}
                                >
                                    {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                                </select>
                            </div>

                            {/* ASSIGNEE */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Assignee</label>
                                <select
                                    className="form-select"
                                    value={currentAssignee}
                                    onChange={(e) => handleUpdateRelation("assigneeId", currentAssignee, e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {/* TEAM */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Team</label>
                                <select
                                    className="form-select"
                                    value={currentTeam}
                                    onChange={(e) => handleUpdateRelation("teamId", currentTeam, e.target.value)}
                                >
                                    <option value="">No Team</option>
                                    {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            {/* PROJECT */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Project</label>
                                <select
                                    className="form-select"
                                    value={currentProject}
                                    onChange={(e) => handleUpdateRelation("projectId", currentProject, e.target.value)}
                                >
                                    <option value="">No Project</option>
                                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {/* STORY */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Story / Parent</label>
                                <select
                                    className="form-select"
                                    value={currentStory}
                                    onChange={(e) => handleUpdateRelation("storyId", currentStory, e.target.value)}
                                >
                                    <option value="">No Story</option>
                                    {stories.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
                                </select>
                            </div>

                            {/* PRIORITY & POINTS */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Priority</label>
                                    <select
                                        className="form-select"
                                        value={task.priority}
                                        onChange={(e) => handleUpdateField("priority", e.target.value)}
                                    >
                                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>Points</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={task.storyPoints || ""}
                                        onChange={(e) => handleUpdateField("storyPoints", e.target.value ? Number(e.target.value) : null)}
                                        placeholder="-"
                                    />
                                </div>
                            </div>

                            <hr style={{ border: "none", borderTop: "1px solid var(--border-light)", margin: "8px 0" }} />

                            {/* ACTIVITY LOG (Mini) */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 12 }}>Recent Activity</label>
                                {sortedLogs.length === 0 ? (
                                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No activity yet.</div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {sortedLogs.slice(0, 5).map(log => (
                                            <div key={log.id} style={{ fontSize: 11, display: "flex", gap: 8 }}>
                                                <div style={{ color: "var(--text-tertiary)", minWidth: 50 }}>
                                                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div style={{ color: "var(--text-secondary)", flex: 1, wordBreak: "break-word" }}>
                                                    {log.action}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
