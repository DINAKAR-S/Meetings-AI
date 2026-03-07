"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

const PROJECT_COLORS = [
    "var(--color-lime)",
    "var(--color-green)",
    "var(--color-emerald)",
    "var(--color-teal)",
    "var(--color-cyan)",
    "var(--color-sky)",
    "var(--color-deep-blue)",
    "var(--color-royal)",
];

export default function ProjectsPage() {
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const [editingProject, setEditingProject] = useState<any>(null);
    const [projectToDelete, setProjectToDelete] = useState<any>(null);

    const { showToast } = useToast();
    const router = useRouter();

    const { isLoading, data } = db.useQuery({
        projects: { meetings: {} },
        tasks: {},
        profiles: {},
        sprints: {},
    });

    const projects = data?.projects || [];
    const allTasks = data?.tasks || [];
    const allProfiles = data?.profiles || [];
    const sprints = data?.sprints || [];

    const globalActiveSprint = sprints.find((s: any) => s.status === "active") ||
        sprints.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0];

    const handleCreate = () => {
        if (!name.trim()) return;
        const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
        db.transact(
            db.tx.projects[id()].update({
                name: name.trim(),
                description: description.trim(),
                color,
                createdAt: Date.now(),
            })
        );
        showToast("Project created successfully");
        setName("");
        setDescription("");
        setShowModal(false);
    };

    const handleEditSubmit = () => {
        if (!name.trim() || !editingProject) return;
        db.transact(
            db.tx.projects[editingProject.id].update({
                name: name.trim(),
                description: description.trim(),
            })
        );
        showToast("Project updated successfully");
        setEditingProject(null);
        setName("");
        setDescription("");
        setShowModal(false);
    };

    const confirmDeleteProject = () => {
        if (!projectToDelete) return;

        const txs: any[] = [];
        // Cascade delete linked meetings
        // We DO NOT delete sprints here since they are global
        // Delete tasks that belong to this project (by projectId field)
        const projectRelatedTasks = allTasks.filter((t: any) => t.projectId === projectToDelete.id);
        projectRelatedTasks.forEach((task: any) => txs.push(db.tx.tasks[task.id].delete()));
        if (projectToDelete.meetings) {
            projectToDelete.meetings.forEach((meeting: any) => txs.push(db.tx.meetings[meeting.id].delete()));
        }

        txs.push(db.tx.projects[projectToDelete.id].delete());
        db.transact(txs);

        showToast("Project and all its associated data deleted successfully");
        setProjectToDelete(null);
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Projects</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        Manage and track all your development projects
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} id="new-project-btn">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Project
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                        <h3>No projects yet</h3>
                        <p>Create your first project to start organizing sprints and tracking tasks.</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setEditingProject(null); setName(""); setDescription(""); setShowModal(true); }}>
                            Create Project
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {projects.map((project: any) => {
                        const projectTasks = allTasks.filter((t: any) => t.projectId === project.id);
                        const totalTasks = projectTasks.length;
                        const doneTasks = projectTasks.filter((t: any) => t.status === "done").length;
                        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

                        const assigneesMap: Record<string, any> = {};
                        projectTasks.forEach((t: any) => {
                            if (t.assigneeId) {
                                const profile = allProfiles.find((p: any) => p.id === t.assigneeId);
                                if (profile) assigneesMap[profile.id] = profile;
                            }
                        });
                        const assignees = Object.values(assigneesMap);

                        return (
                            <div
                                key={project.id}
                                className="hover-card"
                                style={{
                                    padding: 0,
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    cursor: "pointer",
                                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                }}
                                onClick={() => router.push(`/projects/${project.id}/backlog`)}
                            >
                                <div style={{ height: 6, background: project.color || "var(--color-emerald)", opacity: 0.8 }} />
                                <div style={{ padding: "20px 24px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                        <div
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: "12px",
                                                background: `${project.color || "var(--color-emerald)"}22`,
                                                border: `1px solid ${project.color || "var(--color-emerald)"}44`,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800,
                                                fontSize: 18,
                                                color: project.color || "var(--color-emerald)",
                                            }}
                                        >
                                            {project.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingProject(project);
                                                setName(project.name);
                                                setDescription(project.description || "");
                                                setShowModal(true);
                                            }} title="Edit Project">
                                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                </svg>
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => {
                                                e.stopPropagation();
                                                setProjectToDelete(project);
                                            }} style={{ color: "#ef4444" }} title="Delete Project">
                                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{project.name}</div>
                                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, minHeight: 40, marginBottom: 12 }}>
                                            {project.description || "No description provided."}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                            <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>ACTIVE SPRINT:</span>
                                            {globalActiveSprint ? (
                                                <span className="badge" style={{ background: "rgba(20, 184, 139, 0.1)", color: "var(--color-emerald)", border: "1px solid rgba(20, 184, 139, 0.2)" }}>
                                                    {globalActiveSprint.name}
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--text-tertiary)" }}>None</span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center" }}>
                                            {assignees.slice(0, 3).map((a: any, i) => (
                                                <img
                                                    key={a.id}
                                                    src={a.avatarUrl}
                                                    alt={a.name}
                                                    title={a.name}
                                                    style={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: "50%",
                                                        border: "2px solid var(--bg-primary)",
                                                        marginLeft: i > 0 ? -8 : 0,
                                                        position: "relative",
                                                        zIndex: 3 - i
                                                    }}
                                                />
                                            ))}
                                            {assignees.length > 3 && (
                                                <div style={{
                                                    width: 24, height: 24, borderRadius: "50%",
                                                    background: "var(--bg-secondary)", border: "2px solid var(--bg-primary)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 10, fontWeight: 700, marginLeft: -8, zIndex: 0
                                                }}>
                                                    +{assignees.length - 3}
                                                </div>
                                            )}
                                            {assignees.length === 0 && (
                                                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No members</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
                                            {doneTasks}/{totalTasks} tasks
                                        </div>
                                    </div>

                                    <div style={{ marginTop: "auto" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                                            <span>Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="progress-bar" style={{ height: 6 }}>
                                            <div
                                                className="progress-bar-fill"
                                                style={{
                                                    width: `${progress}%`,
                                                    background: project.color || "var(--color-emerald)",
                                                    boxShadow: `0 0 10px ${project.color || "var(--color-emerald)33"}`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Project Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingProject ? "Edit Project" : "New Project"}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setEditingProject(null); }}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Project Name</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Auth Service, Mobile App"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                    id="project-name-input"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Brief description of this project..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    id="project-description-input"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingProject(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={editingProject ? handleEditSubmit : handleCreate} id="create-project-submit">
                                {editingProject ? "Save Changes" : "Create Project"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Project Modal */}
            {projectToDelete && (
                <div className="modal-overlay" onClick={() => setProjectToDelete(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2 style={{ color: "var(--status-testing)" }}>Delete Project</h2>
                        </div>
                        <div className="modal-body" style={{ lineHeight: 1.6 }}>
                            Are you sure you want to delete <strong>{projectToDelete.name}</strong>?<br />
                            This operation will permanently delete ALL associated Tasks and Meeting Insights. This cannot be undone.
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setProjectToDelete(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmDeleteProject} style={{ background: "var(--status-testing)" }}>Permanently Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
