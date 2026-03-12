"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { analyzeMeeting, transcribeAudio } from "@/app/actions/analyze-meeting";
import type { MeetingAnalysisResult } from "@/app/actions/analyze-meeting";
import { checkForDuplicates } from "@/app/actions/check-duplicates";

type InputMode = "text" | "audio";
type ViewTab = "upload" | "insights";

export default function MeetingsPage() {
    const [tab, setTab] = useState<ViewTab>("upload");
    const [inputMode, setInputMode] = useState<InputMode>("text");
    const [transcript, setTranscript] = useState("");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<MeetingAnalysisResult | null>(null);
    const [acceptedTasks, setAcceptedTasks] = useState<Set<string>>(new Set());
    const [insightTab, setInsightTab] = useState<"summary" | "tasks" | "transcript">("summary");
    const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string>>({});

    // Per-Task Selection State (Stored by task title/key)
    const [taskAssignments, setTaskAssignments] = useState<Record<string, {
        projectId: string;
        teamId: string;
        assigneeId: string;
    }>>({});

    // Added: Per-Task Attribute Edits (Title, Description, Priority, Points)
    const [modifiedTasks, setModifiedTasks] = useState<Record<string, {
        title: string;
        description: string;
        priority: string;
        storyPoints: number;
    }>>({});

    const [globalProjectId, setGlobalProjectId] = useState("per-task");
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

    // Modal state for editing AI task details
    const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: "", description: "", priority: "", storyPoints: 0 });

    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        meetings: {},
        tasks: { assignees: {}, project: {}, assignedTeam: {} },
        profiles: {},
        teams: {},
        projects: {},
        sprints: {}
    });

    const meetings = data?.meetings || [];
    const existingTasks = data?.tasks || [];
    const profiles = data?.profiles || [];
    const teams = data?.teams || [];
    const projects = data?.projects || [];
    const sprints = data?.sprints || [];

    const activeSprint = sprints.find((s: any) => s.status === "active");

    const initializeMeetingStates = (aiTasks: any[]) => {
        const initialAssignments: Record<string, any> = {};
        const initialModifications: Record<string, any> = {};

        for (const task of aiTasks) {
            const taskKey = task.title;

            // Automatch logic
            let matchedAssigneeId = "";
            if (task.suggested_assignee_id && profiles.some(p => p.id === task.suggested_assignee_id)) {
                matchedAssigneeId = task.suggested_assignee_id;
            } else if (task.suggested_assignee_name) {
                const name = task.suggested_assignee_name.toLowerCase();
                const match = profiles.find(p => p.name.toLowerCase().includes(name) || name.includes(p.name.split(' ')[0].toLowerCase()));
                if (match) matchedAssigneeId = match.id;
            }

            let matchedProjectId = "";
            if (task.suggested_project_id && projects.some(p => p.id === task.suggested_project_id)) {
                matchedProjectId = task.suggested_project_id;
            } else if (task.suggested_project_name) {
                const name = task.suggested_project_name.toLowerCase();
                const match = projects.find(p => p.name.toLowerCase().includes(name));
                if (match) matchedProjectId = match.id;
            }

            let matchedTeamId = "";
            if (task.suggested_team_id && teams.some(t => t.id === task.suggested_team_id)) {
                matchedTeamId = task.suggested_team_id;
            } else if (task.suggested_team_name) {
                const name = task.suggested_team_name.toLowerCase();
                const match = teams.find(t => t.name.toLowerCase().includes(name));
                if (match) matchedTeamId = match.id;
            }

            initialAssignments[taskKey] = {
                projectId: matchedProjectId,
                teamId: matchedTeamId,
                assigneeId: matchedAssigneeId
            };

            initialModifications[taskKey] = {
                title: task.title,
                description: task.description,
                priority: task.priority || "medium",
                storyPoints: task.story_points || 0
            };
        }
        return { initialAssignments, initialModifications };
    };

    const handleAnalyze = async () => {
        if (!transcript.trim()) return;
        setAnalyzing(true);
        setError("");
        setResult(null);

        const response = await analyzeMeeting(transcript, { profiles, teams, projects, activeSprint });

        if (response.success && response.data) {
            setResult(response.data);
            setTab("insights");
            setInsightTab("summary");
            const aiTasks = response.data.tasks;
            const { initialAssignments, initialModifications } = initializeMeetingStates(aiTasks);
            setTaskAssignments(initialAssignments);
            setModifiedTasks(initialModifications);

            const meetingId = id();
            setActiveMeetingId(meetingId);
            db.transact(
                db.tx.meetings[meetingId].update({
                    title: meetingTitle || "Untitled Meeting",
                    rawTranscript: transcript,
                    summary: response.data.summary,
                    inputType: inputMode,
                    aiResult: JSON.stringify(response.data),
                    processedAt: Date.now(),
                    createdAt: Date.now(),
                })
            );

            // Duplicate checking
            const warnings: Record<string, string> = {};
            for (const task of response.data.tasks) {
                const dupe = await checkForDuplicates(
                    task.title,
                    task.description,
                    existingTasks.map((t: any) => ({ id: t.id, title: t.title, description: t.description || "" }))
                );
                if (dupe.isDuplicate) {
                    warnings[task.title] = `Similar to: "${dupe.matchedTaskTitle}" (${Math.round(dupe.similarityScore * 100)}% match)`;
                }
            }
            setDuplicateWarnings(warnings);
        } else {
            setError(response.error || "Analysis failed");
        }
        setAnalyzing(false);
    };

    const isTaskAlreadyAccepted = (taskTitle: string): boolean => {
        if (acceptedTasks.has(taskTitle)) return true;
        return existingTasks.some((et: any) => et.title.toLowerCase() === taskTitle.toLowerCase());
    };

    const handleAcceptTask = (task: any) => {
        const taskKey = task.title;
        if (isTaskAlreadyAccepted(taskKey)) return;

        const taskId = id();
        const settings = taskAssignments[taskKey] || { projectId: "", teamId: "", assigneeId: "" };
        const mods = modifiedTasks[taskKey] || { title: task.title, description: task.description, priority: task.priority, storyPoints: task.story_points };

        const txs: any[] = [
            db.tx.tasks[taskId].update({
                title: mods.title,
                description: mods.description,
                status: "backlog",
                priority: mods.priority,
                storyPoints: mods.storyPoints,
                skillCategory: task.skill_category || "",
                createdAt: Date.now(),
                source: "Meeting"
            }).link({
                sourceMeeting: activeMeetingId ?? undefined
            })
        ];

        const finalProjectId = globalProjectId !== "per-task" ? globalProjectId : settings.projectId;
        if (finalProjectId) txs.push(db.tx.tasks[taskId].link({ project: finalProjectId }));
        if (settings.teamId) txs.push(db.tx.tasks[taskId].link({ assignedTeam: settings.teamId }));
        if (settings.assigneeId) txs.push(db.tx.tasks[taskId].link({ assignees: settings.assigneeId }));

        db.transact(txs);
        setAcceptedTasks(prev => new Set(prev).add(taskKey));
        showToast(`Task created: ${mods.title}`);
    };

    const handleAcceptAll = () => {
        if (!result?.tasks) return;
        result.tasks.forEach(task => {
            if (!isTaskAlreadyAccepted(task.title)) {
                handleAcceptTask(task);
            }
        });
        showToast("All tasks accepted and created");
    };

    const openEditTaskModal = (taskKey: string, fallbackTask?: any) => {
        let current = modifiedTasks[taskKey];
        if (!current && fallbackTask) {
            // Hot-initialize if state is missing (happens when clicking history)
            const { initialModifications, initialAssignments } = initializeMeetingStates([fallbackTask]);
            setModifiedTasks(prev => ({ ...prev, ...initialModifications }));
            setTaskAssignments(prev => ({ ...prev, ...initialAssignments }));
            current = initialModifications[taskKey];
        }

        if (current) {
            setEditForm({ ...current });
            setEditingTaskKey(taskKey);
        }
    };

    const saveEditedTask = () => {
        if (editingTaskKey) {
            setModifiedTasks(prev => ({ ...prev, [editingTaskKey]: { ...editForm } }));
            setEditingTaskKey(null);
        }
    };

    const handleDownloadTranscript = () => {
        const m = meetings.find(m => m.id === activeMeetingId);
        if (!m || !m.rawTranscript) return;
        const blob = new Blob([m.rawTranscript], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${m.title || "meeting-transcript"}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><div className="spinner" /></div>;

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Meeting Intelligence</h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0" }}>Upload transcripts and extract sprint tasks with AI</p>
            </div>

            <div className="tabs" style={{ marginBottom: 24, borderBottom: "1px solid var(--border-light)" }}>
                <button className={`tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")} style={{ padding: "12px 24px" }}>Upload & Analyze</button>
                <button className={`tab ${tab === "insights" ? "active" : ""}`} onClick={() => setTab("insights")} style={{ padding: "12px 24px" }}>Insights {result ? "✓" : ""}</button>
            </div>

            {tab === "upload" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
                    <div className="card">
                        <div className="card-header"><span style={{ fontSize: 15, fontWeight: 700 }}>Analyze New Meeting</span></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Meeting Title</label>
                                <input className="form-input" placeholder="e.g. Q1 Roadmap Planning" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Input Source</label>
                                <div style={{ display: "flex", gap: 12 }}>
                                    {(["text", "audio"] as const).map(mode => (
                                        <button key={mode} className={`filter-chip ${inputMode === mode ? "active" : ""}`} onClick={() => setInputMode(mode)} style={{ padding: "8px 16px" }}>
                                            {mode === "text" ? "📝 Paste Transcript" : "🎙️ Upload Audio"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {inputMode === "audio" ? (
                                <div className="upload-area" style={{ height: 200, border: "2px dashed var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
                                    <div style={{ textAlign: "center" }}>
                                        <input type="file" id="audio-upload" hidden accept="audio/*" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setAnalyzing(true);
                                            const fd = new FormData();
                                            fd.append("audio", file);
                                            const res = await transcribeAudio(fd);
                                            if (res.success && res.transcript) setTranscript(res.transcript);
                                            else setError(res.error || "Failed");
                                            setAnalyzing(false);
                                        }} />
                                        <label htmlFor="audio-upload" style={{ cursor: "pointer", color: "var(--color-indigo)", fontWeight: 600 }}>Click to upload audio file</label>
                                    </div>
                                </div>
                            ) : (
                                <textarea className="form-textarea" style={{ minHeight: 240, background: "var(--bg-secondary)", borderRadius: 12, padding: 16 }} placeholder="Paste meeting transcript..." value={transcript} onChange={e => setTranscript(e.target.value)} />
                            )}
                            <button className="btn btn-primary" style={{ width: "100%", marginTop: 20, height: 44, fontWeight: 600 }} onClick={handleAnalyze} disabled={analyzing || !transcript.trim()}>
                                {analyzing ? "Analyzing..." : "Start Intelligence Analysis"}
                            </button>
                        </div>
                    </div>
                    {/* History Sidebar */}
                    <div className="card">
                        <div className="card-header"><span style={{ fontSize: 15, fontWeight: 700 }}>Recent Analysis</span></div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {meetings.map((m: any) => (
                                <div key={m.id} className="hover-card" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }} onClick={() => {
                                    if (m.aiResult) {
                                        const res = JSON.parse(m.aiResult);
                                        setResult(res);
                                        setTab("insights");
                                        setActiveMeetingId(m.id);

                                        // Re-initialize states for history loading
                                        const { initialAssignments, initialModifications } = initializeMeetingStates(res.tasks || []);
                                        setTaskAssignments(initialAssignments);
                                        setModifiedTasks(initialModifications);
                                    }
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{new Date(m.createdAt).toLocaleDateString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === "insights" && result && (
                <div>
                    <div className="tabs" style={{ marginBottom: 24, display: "flex", gap: 32, fontSize: 14, fontWeight: 600 }}>
                        <button className={`tab-underlined ${insightTab === "summary" ? "active" : ""}`} onClick={() => setInsightTab("summary")}>Summary</button>
                        <button className={`tab-underlined ${insightTab === "tasks" ? "active" : ""}`} onClick={() => setInsightTab("tasks")}>Tasks ({result.tasks?.length || 0})</button>
                        <button className={`tab-underlined ${insightTab === "transcript" ? "active" : ""}`} onClick={() => setInsightTab("transcript")}>Transcript</button>
                    </div>

                    {insightTab === "summary" && (
                        <div>
                            <div className="card" style={{ marginBottom: 24, border: "none", boxShadow: "var(--shadow-sm)" }}>
                                <div className="card-body" style={{ padding: 24 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                        <span style={{ color: "var(--color-green)", fontSize: 18 }}>✦</span>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>AI Summary</h3>
                                    </div>
                                    <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 24 }}>{result.summary}</p>
                                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "12px 16px", display: "inline-block" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 4 }}>Meeting Topic</div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{result.project || "General Sync"}</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                                <div className="card" style={{ border: "none", boxShadow: "var(--shadow-sm)" }}><div className="card-body"><h4>TASKS GENERATED</h4><div style={{ fontSize: 32, fontWeight: 700 }}>{result.tasks?.length || 0}</div></div></div>
                                <div className="card" style={{ border: "none", boxShadow: "var(--shadow-sm)" }}><div className="card-body"><h4>BLOCKERS</h4><div style={{ fontSize: 32, fontWeight: 700 }}>{result.blockers?.length || 0}</div></div></div>
                            </div>

                            {/* Restored Decisions and Blockers lists */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                {result.decisions?.length > 0 && (
                                    <div className="card" style={{ border: "none", boxShadow: "var(--shadow-sm)" }}>
                                        <div className="card-header" style={{ background: "none", borderBottom: "1px solid var(--border-light)" }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                                📌 Key Decisions
                                            </span>
                                        </div>
                                        <div className="card-body" style={{ padding: 20 }}>
                                            <ul style={{ fontSize: 13, paddingLeft: 20, margin: 0, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                                                {result.decisions.map((d, i) => <li key={i} style={{ marginBottom: 8 }}>{d}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                {result.blockers?.length > 0 && (
                                    <div className="card" style={{ border: "none", boxShadow: "var(--shadow-sm)" }}>
                                        <div className="card-header" style={{ background: "none", borderBottom: "1px solid var(--border-light)" }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                                                🚨 Blockers Identified
                                            </span>
                                        </div>
                                        <div className="card-body" style={{ padding: 20 }}>
                                            <ul style={{ fontSize: 13, paddingLeft: 20, margin: 0, lineHeight: 1.6, color: "#ef4444" }}>
                                                {result.blockers.map((b, i) => <li key={i} style={{ marginBottom: 8 }}>{b}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {insightTab === "tasks" && (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, background: "var(--bg-secondary)", borderRadius: 12, padding: "16px 24px", border: "1px solid var(--border-light)" }}>
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <span style={{ fontSize: 14, fontWeight: 500 }}>Link tasks to project:</span>
                                    <select className="form-select" style={{ width: 240 }} value={globalProjectId} onChange={e => setGlobalProjectId(e.target.value)}>
                                        <option value="per-task">— Use per-task settings —</option>
                                        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <button className="btn btn-primary" onClick={handleAcceptAll}>Accept All & Create Tasks</button>
                            </div>

                            <div className="card" style={{ border: "none", boxShadow: "var(--shadow-sm)" }}>
                                <div className="card-body" style={{ padding: 0 }}>
                                    {result.tasks?.map((task, i) => {
                                        const taskKey = task.title;
                                        const accepted = acceptedTasks.has(taskKey) || existingTasks.some((et: any) => et.title.toLowerCase() === taskKey.toLowerCase());
                                        const settings = taskAssignments[taskKey] || { projectId: "", teamId: "", assigneeId: "" };
                                        const mods = modifiedTasks[taskKey] || { title: task.title, description: task.description, priority: task.priority, storyPoints: task.story_points };

                                        return (
                                            <div key={i} style={{ padding: "24px", borderBottom: "1px solid var(--border-light)", display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start", opacity: accepted ? 0.6 : 1 }}>
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border-light)" }} />
                                                        <div style={{ fontWeight: 600, fontSize: 15 }}>{mods.title}</div>
                                                        <span className={`badge badge-${mods.priority}`}>{mods.priority}</span>
                                                        <span className="badge" style={{ background: "var(--bg-secondary)" }}>{mods.storyPoints} pts</span>
                                                        {!accepted && (
                                                            <button onClick={() => openEditTaskModal(taskKey, task)} style={{ background: "none", border: "none", color: "var(--color-indigo)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Edit Details</button>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "var(--text-secondary)", paddingLeft: 20 }}>{mods.description}</div>
                                                </div>

                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <select className="form-select-sm" value={settings.projectId} onChange={e => setTaskAssignments(p => ({ ...p, [taskKey]: { ...p[taskKey], projectId: e.target.value } }))} disabled={accepted || globalProjectId !== "per-task"}>
                                                            <option value="">No Project</option>
                                                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                        <select className="form-select-sm" value={settings.teamId} onChange={e => setTaskAssignments(p => ({ ...p, [taskKey]: { ...p[taskKey], teamId: e.target.value } }))} disabled={accepted}>
                                                            <option value="">No Team</option>
                                                            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <select className="form-select-sm" style={{ flex: 1 }} value={settings.assigneeId} onChange={e => setTaskAssignments(p => ({ ...p, [taskKey]: { ...p[taskKey], assigneeId: e.target.value } }))} disabled={accepted}>
                                                            <option value="">No Assignee</option>
                                                            {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                        <button className={`btn btn-sm ${accepted ? "btn-secondary" : "btn-primary"}`} disabled={accepted} onClick={() => handleAcceptTask(task)}>
                                                            {accepted ? "✓" : "Accept"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {insightTab === "transcript" && (
                        <div className="card">
                            <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Meeting Transcript</span>
                                <button className="btn btn-ghost btn-sm" onClick={handleDownloadTranscript}>Download .txt</button>
                            </div>
                            <div className="card-body">
                                <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: 12, maxHeight: 600, overflowY: "auto", fontSize: 14, whiteSpace: "pre-wrap" }}>
                                    {meetings.find(m => m.id === activeMeetingId)?.rawTranscript || "..."}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Editing Modal */}
            {editingTaskKey && (
                <div className="modal-overlay" onClick={() => setEditingTaskKey(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit AI Task Details</h2></div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input className="form-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" style={{ minHeight: 100 }} value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select className="form-select" value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Story Points</label>
                                    <input type="number" className="form-input" value={editForm.storyPoints} onChange={e => setEditForm(p => ({ ...p, storyPoints: parseInt(e.target.value) }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditingTaskKey(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveEditedTask}>Apply Changes</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .tab-underlined { background: none; border: none; padding: 8px 0; color: var(--text-tertiary); cursor: pointer; position: relative; }
                .tab-underlined.active { color: var(--text-primary); }
                .tab-underlined.active::after { content: ""; position: absolute; bottom: -25px; left: 0; right: 0; height: 2px; background: var(--color-green); }
                .form-select-sm { width: 100%; height: 32px; padding: 4px 8px; background: var(--bg-primary); border: 1px solid var(--border-light); border-radius: 6px; font-size: 11px; outline: none; }
            `}</style>
        </div>
    );
}
