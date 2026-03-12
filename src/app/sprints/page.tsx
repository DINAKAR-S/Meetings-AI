"use client";

import { db } from "@/lib/db";
import { useState } from "react";
import Link from "next/link";
import { id } from "@instantdb/react";
import { useToast } from "@/components/Toast";
import { SprintHealthDashboard } from "@/components/SprintHealthDashboard";

export default function GlobalSprintsPage() {
    const [filterStatus, setFilterStatus] = useState("all");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [newSprintName, setNewSprintName] = useState("");
    const [newSprintStart, setNewSprintStart] = useState("");
    const [newSprintEnd, setNewSprintEnd] = useState("");
    const [newSprintCapacity, setNewSprintCapacity] = useState("");
    const [newSprintStatus, setNewSprintStatus] = useState("planning");
    const [editingSprint, setEditingSprint] = useState<any>(null);
    const [sprintToDelete, setSprintToDelete] = useState<any>(null);

    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        sprints: {
            project: {}
        },
        tasks: {
            sprint: {},
            assignees: {}
        },
        profiles: {}
    });

    const sprints = data?.sprints || [];
    const allTasks = data?.tasks || [];
    const profiles = data?.profiles || [];

    const activeSprint = sprints.find((s: any) => s.status === "active");

    // Apply filters and sort
    const filteredSprints = sprints
        .filter((s: any) => {
            if (filterStatus !== "all" && s.status !== filterStatus) return false;
            return true;
        })
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    const handleSaveSprint = () => {
        if (!newSprintName.trim()) {
            showToast("Sprint name is required");
            return;
        }

        const sprintId = editingSprint ? editingSprint.id : id();
        db.transact([
            db.tx.sprints[sprintId].update({
                name: newSprintName.trim(),
                startDate: newSprintStart,
                endDate: newSprintEnd,
                capacity: newSprintCapacity ? parseInt(newSprintCapacity) : 0,
                status: newSprintStatus,
                ...(editingSprint ? {} : { createdAt: Date.now() })
            })
        ]);

        showToast(editingSprint ? "Sprint updated successfully" : "Sprint created successfully");
        closeModal();
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingSprint(null);
        setNewSprintName("");
        setNewSprintStart("");
        setNewSprintEnd("");
        setNewSprintCapacity("");
        setNewSprintStatus("planning");
    };

    const openEditModal = (sprint: any) => {
        setEditingSprint(sprint);
        setNewSprintName(sprint.name || "");
        setNewSprintStart(sprint.startDate || "");
        setNewSprintEnd(sprint.endDate || "");
        setNewSprintCapacity(sprint.capacity?.toString() || "");
        setNewSprintStatus(sprint.status || "planning");
        setShowCreateModal(true);
    };

    const handleDeleteSprint = (sprint: any) => {
        setSprintToDelete(sprint);
    };

    const confirmDeleteSprint = () => {
        if (!sprintToDelete) return;

        db.transact([
            db.tx.sprints[sprintToDelete.id].delete()
        ]);

        showToast("Sprint deleted");
        setSprintToDelete(null);
    };

    const handleUpdateStatus = (sprintId: string, newStatus: string) => {
        db.transact([
            db.tx.sprints[sprintId].update({ status: newStatus })
        ]);
        showToast(`Sprint marked as ${newStatus}`);
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
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Company Sprints</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        Manage global sprint cycles across all projects
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Create Sprint
                </button>
            </div>

            {/* AI Risk Detection Dashboard */}
            {activeSprint && (
                <SprintHealthDashboard
                    sprint={activeSprint}
                    tasks={allTasks.filter((t: any) => t.sprint?.id === activeSprint?.id)}
                    profiles={profiles}
                />
            )}

            {/* Filters */}
            <div className="filter-bar" style={{ flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", alignSelf: "center", marginRight: 4 }}>Status:</span>
                <button className={`filter-chip ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>All</button>
                {["planning", "active", "completed"].map((s) => (
                    <button key={s} className={`filter-chip ${filterStatus === s ? "active" : ""}`} onClick={() => setFilterStatus(s)}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
                {filteredSprints.length === 0 ? (
                    <div className="empty-state">
                        <h3>No sprints found</h3>
                        <p>{sprints.length === 0 ? "You have not created any global sprints yet." : "Adjust your filters to see results."}</p>
                        {sprints.length === 0 && (
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreateModal(true)}>
                                Create First Sprint
                            </button>
                        )}
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Sprint Name</th>
                                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Dates</th>
                                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Tasks</th>
                                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Status</th>
                                <th style={{ textAlign: "right", padding: "12px 16px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSprints.map((sprint: any) => {
                                const sprintTasks = allTasks.filter((t: any) => t.sprint?.id === sprint.id);
                                const completedTasks = sprintTasks.filter((t: any) => t.status === "done");
                                const totalPoints = sprintTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);

                                return (
                                    <tr key={sprint.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.1s" }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}>

                                        <td style={{ padding: "16px", fontWeight: 600 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {sprint.name}
                                                {sprint.capacity ? <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 400 }}>({sprint.capacity} pts capacity)</span> : null}
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                                            {sprint.startDate || "?"} {sprint.endDate ? `→ ${sprint.endDate}` : ""}
                                        </td>
                                        <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                                            {sprintTasks.length} tasks
                                            {totalPoints > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{totalPoints} pts</span>}
                                        </td>
                                        <td style={{ padding: "16px" }}>
                                            <span className={`badge badge-${sprint.status === "active" ? "done" : sprint.status === "completed" ? "medium" : "progress"}`}>
                                                {sprint.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "16px", textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                            {sprint.status === "planning" && (
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleUpdateStatus(sprint.id, "active")}>Start</button>
                                            )}
                                            {sprint.status === "active" && (
                                                <button className="btn btn-sm" style={{ background: "var(--status-done)", color: "white" }} onClick={() => handleUpdateStatus(sprint.id, "completed")}>Complete</button>
                                            )}

                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(sprint)}>Edit</button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }} onClick={() => handleDeleteSprint(sprint)}>Delete</button>

                                            <Link href={`/sprint-board?sprint=${sprint.id}`} className="btn btn-secondary btn-sm">
                                                Board
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create / Edit Sprint Modal */}
            {
                showCreateModal && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editingSprint ? "Edit Sprint" : "Create Global Sprint"}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={closeModal}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Sprint Name *</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. Sprint 24"
                                        value={newSprintName}
                                        onChange={e => setNewSprintName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">Start Date</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={newSprintStart}
                                            onChange={e => setNewSprintStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Date</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={newSprintEnd}
                                            onChange={e => setNewSprintEnd(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Team Capacity (Story Points, Optional)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="e.g. 50"
                                        value={newSprintCapacity}
                                        onChange={e => setNewSprintCapacity(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label className="form-label">Status</label>
                                    <select
                                        className="form-select"
                                        value={newSprintStatus}
                                        onChange={e => setNewSprintStatus(e.target.value)}
                                    >
                                        <option value="planning">Planning</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSaveSprint}>{editingSprint ? "Save Changes" : "Create Sprint"}</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Delete Confirmation Modal */}
            {sprintToDelete && (
                <div className="modal-overlay" onClick={() => setSprintToDelete(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ color: "var(--status-testing)" }}>Delete Sprint</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setSprintToDelete(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>{sprintToDelete.name}</strong>?</p>
                            <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                                Tasks inside this sprint will NOT be deleted, but they will be returned to the backlog.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSprintToDelete(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ background: "var(--status-testing)", borderColor: "var(--status-testing)" }} onClick={confirmDeleteSprint}>
                                Delete Sprint
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
