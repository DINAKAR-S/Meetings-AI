"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { analyzeMeeting, transcribeAudio } from "@/app/actions/analyze-meeting";
import type { MeetingAnalysisResult } from "@/app/actions/analyze-meeting";
import { checkForDuplicates } from "@/app/actions/check-duplicates";

type InputMode = "text" | "audio" | "notes";
type ViewTab = "upload" | "insights";

export default function MeetingsPage() {
    const [tab, setTab] = useState<ViewTab>("upload");
    const [inputMode, setInputMode] = useState<InputMode>("text");
    const [transcript, setTranscript] = useState("");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<MeetingAnalysisResult | null>(null);
    const [acceptedStories, setAcceptedStories] = useState<Set<string>>(new Set());
    const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string>>({});
    const [assigneeMappings, setAssigneeMappings] = useState<Record<string, string>>({}); // name -> profileId
    const [meetingToDelete, setMeetingToDelete] = useState<any>(null);
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [taskProjectOverrides, setTaskProjectOverrides] = useState<Record<string, string>>({}); // taskTitle -> projectId
    const [taskTeamOverrides, setTaskTeamOverrides] = useState<Record<string, string>>({}); // taskTitle -> teamId
    const [globalProjectId, setGlobalProjectId] = useState(""); // fallback project for all accepted tasks
    const [quickProfileName, setQuickProfileName] = useState("");
    const [quickProfileRole, setQuickProfileRole] = useState("");
    const [showQuickProfileModal, setShowQuickProfileModal] = useState(false);

    // AI Task Editing State
    const [editingAiTask, setEditingAiTask] = useState<{ epicIndex: number, storyIndex: number, taskIndex: number, task: any } | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDesc, setEditTaskDesc] = useState("");
    const [editTaskPriority, setEditTaskPriority] = useState("");
    const [editTaskAssigneeName, setEditTaskAssigneeName] = useState("");

    const { showToast } = useToast();

    const { isLoading, data } = db.useQuery({
        meetings: {},
        tasks: {},
        stories: {},
        profiles: {},
        teams: {},
        projects: {}
    });

    const meetings = data?.meetings || [];
    const existingTasks = data?.tasks || [];
    const profiles = data?.profiles || [];
    const teams = data?.teams || [];
    const projects = data?.projects || [];

    const handleAnalyze = async () => {
        if (!transcript.trim()) return;
        setAnalyzing(true);
        setError("");
        setResult(null);

        const response = await analyzeMeeting(transcript, { profiles, teams, projects });

        if (response.success && response.data) {
            setResult(response.data);
            setTab("insights");

            // Auto-set project from AI result
            if (response.data?.project) {
                const p = projects.find((proj: any) => proj.name.toLowerCase() === response.data!.project!.toLowerCase());
                // Just for display, no global state needed
            }

            // Auto-match assignees and projects/teams per task
            const aMappings: Record<string, string> = {};
            const pOverrides: Record<string, string> = {};
            const tOverrides: Record<string, string> = {};
            for (const epic of response.data.epics) {
                for (const story of epic.stories) {
                    for (const task of story.tasks) {
                        // Auto-match assignee
                        if (task.suggested_assignee_name && !task.suggested_assignee_id) {
                            const match = profiles.find(p =>
                                p.name.toLowerCase().includes(task.suggested_assignee_name!.toLowerCase()) ||
                                task.suggested_assignee_name!.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())
                            );
                            if (match) {
                                aMappings[task.suggested_assignee_name] = match.id;
                            }
                        }
                        // Auto-match per-task project
                        if (task.suggested_project_id) {
                            const exists = projects.find((p: any) => p.id === task.suggested_project_id);
                            if (exists) pOverrides[task.title] = task.suggested_project_id;
                        } else if (task.suggested_project_name) {
                            const match = projects.find((p: any) => p.name.toLowerCase().includes(task.suggested_project_name!.toLowerCase()) || task.suggested_project_name!.toLowerCase().includes(p.name.toLowerCase()));
                            if (match) pOverrides[task.title] = match.id;
                        }
                        // Auto-match per-task team
                        if (task.suggested_team_id) {
                            const exists = teams.find((t: any) => t.id === task.suggested_team_id);
                            if (exists) tOverrides[task.title] = task.suggested_team_id;
                        } else if (task.suggested_team_name) {
                            const match = teams.find((t: any) => t.name.toLowerCase().includes(task.suggested_team_name!.toLowerCase()));
                            if (match) tOverrides[task.title] = match.id;
                        }
                    }
                }
            }
            if (Object.keys(aMappings).length > 0) setAssigneeMappings(prev => ({ ...prev, ...aMappings }));
            if (Object.keys(pOverrides).length > 0) setTaskProjectOverrides(prev => ({ ...prev, ...pOverrides }));
            if (Object.keys(tOverrides).length > 0) setTaskTeamOverrides(prev => ({ ...prev, ...tOverrides }));

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

            const warnings: Record<string, string> = {};
            for (const epic of response.data.epics) {
                for (const story of epic.stories) {
                    for (const task of story.tasks) {
                        const dupe = await checkForDuplicates(
                            task.title,
                            task.description,
                            existingTasks.map((t) => ({
                                id: t.id,
                                title: t.title,
                                description: t.description || "",
                            }))
                        );
                        if (dupe.isDuplicate) {
                            warnings[task.title] = `Similar to: "${dupe.matchedTaskTitle}" (${Math.round(dupe.similarityScore * 100)}% match)`;
                        }
                    }
                }
            }
            setDuplicateWarnings(warnings);
        } else {
            setError(response.error || "Analysis failed");
        }
        setAnalyzing(false);
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAnalyzing(true);
        setError("");

        const fd = new FormData();
        fd.append("audio", file);
        const res = await transcribeAudio(fd);
        if (res.success && res.transcript) {
            setTranscript(res.transcript);
            setInputMode("audio");
        } else {
            setError(res.error || "Transcription failed");
        }
        setAnalyzing(false);
    };

    // Detect stories that have already been accepted by checking if their task titles exist in the DB or via saved keys
    const isStoryAlreadyAccepted = (epic: any, story: any): boolean => {
        const storyKey = `${epic.title}::${story.title}`;
        if (activeMeetingId) {
            const m = meetings.find((x: any) => x.id === activeMeetingId);
            if (m?.acceptedStoryKeys) {
                try {
                    const keys = JSON.parse(m.acceptedStoryKeys);
                    if (keys.includes(storyKey)) return true;
                } catch { }
            }
        }

        const taskTitles = story.tasks.map((t: any) => t.title.toLowerCase());
        const matchingCount = taskTitles.filter((title: string) =>
            existingTasks.some((et: any) => et.title.toLowerCase() === title)
        ).length;
        return matchingCount > 0 && matchingCount >= taskTitles.length * 0.5; // >50% match = already accepted
    };

    const handleAcceptStory = (epic: any, story: any) => {
        const storyKey = `${epic.title}::${story.title}`;
        if (acceptedStories.has(storyKey) || isStoryAlreadyAccepted(epic, story)) return;

        let currentMeeting = meetings.find((m: any) => m.id === activeMeetingId);
        let updatedKeys = currentMeeting?.acceptedStoryKeys ? JSON.parse(currentMeeting.acceptedStoryKeys) : [];
        if (!updatedKeys.includes(storyKey)) updatedKeys.push(storyKey);

        // Helper: resolve a project ID — check UUID first, then match by name
        const resolveProjectId = (suggestedId?: string | null, suggestedName?: string | null): string | null => {
            if (suggestedId) {
                const byId = projects.find((p: any) => p.id === suggestedId);
                if (byId) return byId.id;
                // AI might have returned name instead of UUID
                const byName = projects.find((p: any) => p.name.toLowerCase() === suggestedId.toLowerCase());
                if (byName) return byName.id;
            }
            if (suggestedName) {
                const match = projects.find((p: any) =>
                    p.name.toLowerCase() === suggestedName.toLowerCase() ||
                    p.name.toLowerCase().includes(suggestedName.toLowerCase()) ||
                    suggestedName.toLowerCase().includes(p.name.toLowerCase())
                );
                if (match) return match.id;
            }
            return null;
        };

        // Helper: resolve a team ID
        const resolveTeamId = (suggestedId?: string | null, suggestedName?: string | null): string | null => {
            if (suggestedId) {
                const byId = teams.find((t: any) => t.id === suggestedId);
                if (byId) return byId.id;
                const byName = teams.find((t: any) => t.name.toLowerCase() === suggestedId.toLowerCase());
                if (byName) return byName.id;
            }
            if (suggestedName) {
                const match = teams.find((t: any) =>
                    t.name.toLowerCase() === suggestedName.toLowerCase() ||
                    t.name.toLowerCase().includes(suggestedName.toLowerCase())
                );
                if (match) return match.id;
            }
            return null;
        };

        // Helper: resolve an assignee ID
        const resolveAssigneeId = (suggestedId?: string | null, suggestedName?: string | null): string | null => {
            // Check explicit mapping first
            if (suggestedName && assigneeMappings[suggestedName]) {
                return assigneeMappings[suggestedName];
            }
            if (suggestedId && suggestedId !== "null") {
                const byId = profiles.find((p: any) => p.id === suggestedId);
                if (byId) return byId.id;
                // AI might have returned name instead of UUID
                const byName = profiles.find((p: any) => p.name.toLowerCase() === suggestedId.toLowerCase());
                if (byName) return byName.id;
            }
            if (suggestedName) {
                const match = profiles.find((p: any) =>
                    p.name.toLowerCase() === suggestedName.toLowerCase() ||
                    p.name.toLowerCase().includes(suggestedName.toLowerCase()) ||
                    suggestedName.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())
                );
                if (match) return match.id;
            }
            return null;
        };

        const storyId = id();
        const txs: any[] = [
            db.tx.stories[storyId].update({
                title: story.title,
                description: story.description,
                priority: story.priority,
                status: "backlog",
                createdAt: Date.now(),
            })
        ];

        if (activeMeetingId) {
            txs.push(db.tx.meetings[activeMeetingId].update({ acceptedStoryKeys: JSON.stringify(updatedKeys) }));
            if (globalProjectId) {
                txs.push(db.tx.meetings[activeMeetingId].link({ project: globalProjectId }));
            }
        }

        let createdCount = 0;
        let linkedProject = "";

        for (const task of story.tasks) {
            if (!duplicateWarnings[task.title]) {
                const taskId = id();

                txs.push(
                    db.tx.tasks[taskId].update({
                        title: task.title,
                        description: task.description,
                        status: "backlog",
                        priority: task.priority,
                        storyPoints: task.story_points || null,
                        createdAt: Date.now(),
                        storyId: storyId,
                        // Store relationship IDs directly as string fields
                        projectId: "",
                        teamId: "",
                        assigneeId: "",
                        meetingId: activeMeetingId || "",
                        sprintId: "",
                    })
                );

                // Project: per-task override > AI suggestion (resolve by UUID/name) > global selector
                const overrideProjectId = taskProjectOverrides[task.title];
                const resolvedProjectId = overrideProjectId ||
                    resolveProjectId(task.suggested_project_id, task.suggested_project_name) ||
                    globalProjectId ||
                    null;

                if (resolvedProjectId) {
                    txs.push(db.tx.tasks[taskId].update({ projectId: resolvedProjectId }));
                    const pName = projects.find((p: any) => p.id === resolvedProjectId)?.name;
                    console.log(`[Tasks] Setting task "${task.title}" projectId: ${pName} (${resolvedProjectId})`);
                    if (pName) linkedProject = pName;
                } else {
                    console.warn(`[Tasks] No project found for task "${task.title}" — it will appear in global backlog only`);
                }

                // Team: per-task override > AI suggestion
                const overrideTeamId = taskTeamOverrides[task.title];
                const resolvedTeamId = overrideTeamId ||
                    resolveTeamId(task.suggested_team_id, task.suggested_team_name) ||
                    null;

                if (resolvedTeamId) {
                    txs.push(db.tx.tasks[taskId].update({ teamId: resolvedTeamId }));
                    console.log(`[Tasks] Setting task "${task.title}" teamId: ${resolvedTeamId}`);
                }

                // Assignee
                const resolvedAssigneeId = resolveAssigneeId(task.suggested_assignee_id, task.suggested_assignee_name);

                if (resolvedAssigneeId) {
                    txs.push(db.tx.tasks[taskId].update({ assigneeId: resolvedAssigneeId }));
                    const aName = profiles.find((p: any) => p.id === resolvedAssigneeId)?.name;
                    console.log(`[Tasks] Setting task "${task.title}" assigneeId: ${aName} (${resolvedAssigneeId})`);
                }

                // Activity log
                const activityId = id();
                txs.push(db.tx.activityLogs[activityId].update({
                    action: "Task created from meeting transcript",
                    entityId: taskId,
                    entityType: "task",
                    createdAt: Date.now()
                }).link({ task: taskId }));

                createdCount++;
            }
        }

        console.log(`[Tasks] Executing transaction with ${txs.length} operations for ${createdCount} tasks`);
        db.transact(txs);

        setAcceptedStories((prev) => new Set(prev).add(storyKey));
        showToast(`✓ Created ${createdCount} tasks for: ${story.title}${linkedProject ? ` → ${linkedProject}` : ""}`);
    };

    const handleUpdateAiTask = () => {
        if (!editingAiTask || !result) return;
        const newResult = { ...result };
        newResult.epics[editingAiTask.epicIndex].stories[editingAiTask.storyIndex].tasks[editingAiTask.taskIndex] = {
            ...editingAiTask.task,
            title: editTaskTitle,
            description: editTaskDesc,
            priority: editTaskPriority,
            suggested_assignee_name: editTaskAssigneeName
        };
        setResult(newResult);
        setEditingAiTask(null);
        showToast("AI Task updated");
    };

    const handleDeleteAiTask = (epicIndex: number, storyIndex: number, taskIndex: number) => {
        if (!result) return;
        const newResult = { ...result };
        newResult.epics[epicIndex].stories[storyIndex].tasks.splice(taskIndex, 1);
        setResult(newResult);
        showToast("Task removed from AI suggestions");
    };

    const handleAcceptAll = () => {
        if (!result) return;
        for (const epic of result.epics) {
            for (const story of epic.stories) {
                handleAcceptStory(epic, story);
            }
        }
    };

    const confirmDeleteMeeting = () => {
        if (!meetingToDelete) return;
        db.transact(db.tx.meetings[meetingToDelete.id].delete());
        showToast("Meeting deleted successfully");
        setMeetingToDelete(null);
        if (result && meetingToDelete.aiResult && JSON.stringify(result) === meetingToDelete.aiResult) {
            setResult(null);
        }
    };

    const handleCreateQuickProfile = () => {
        if (!quickProfileName) return;
        const profileId = id();
        db.transact(
            db.tx.profiles[profileId].update({
                name: quickProfileName,
                role: quickProfileRole || "Developer",
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${quickProfileName}`,
                status: "Available",
                capacity: 20,
                createdAt: Date.now()
            })
        );
        setAssigneeMappings(prev => ({ ...prev, [quickProfileName]: profileId }));
        setShowQuickProfileModal(false);
        setQuickProfileName("");
        setQuickProfileRole("");
        showToast(`Profile created for ${quickProfileName}`);
    };

    const getProfileDetails = (profileId: string | null | undefined, profileName: string | null | undefined) => {
        if (profileId) {
            const profile = profiles.find(p => p.id === profileId);
            if (profile) return { name: profile.name, avatar: profile.avatarUrl, isMatched: true };
        }
        if (profileName) {
            return { name: profileName, avatar: null, isMatched: false };
        }
        return null;
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
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Meeting Intelligence</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        Upload transcripts and extract sprint tasks with AI
                    </p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>
                    Upload & Analyze
                </button>
                <button className={`tab ${tab === "insights" ? "active" : ""}`} onClick={() => setTab("insights")}>
                    Insights {result ? "✓" : ""}
                </button>
            </div>

            {tab === "upload" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontSize: 14, fontWeight: 700 }}>Meeting Input</span>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Meeting Title</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Sprint Planning – Mar 6"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    id="meeting-title-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Input Type</label>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {(["text", "audio", "notes"] as InputMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            className={`filter-chip ${inputMode === mode ? "active" : ""}`}
                                            onClick={() => setInputMode(mode)}
                                        >
                                            {mode === "text" ? "📝 Transcript" : mode === "audio" ? "🎙️ Audio" : "📋 Notes"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {inputMode === "audio" ? (
                                <div className="upload-area">
                                    <div className="upload-icon">
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--text-tertiary)">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                                        </svg>
                                    </div>
                                    <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Upload audio file</p>
                                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>MP3, WAV, M4A up to 25MB</p>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleAudioUpload}
                                        style={{ marginTop: 12 }}
                                        id="audio-upload-input"
                                    />
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">
                                        {inputMode === "text" ? "Meeting Transcript" : "Meeting Notes"}
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={
                                            inputMode === "text"
                                                ? "Paste the full meeting transcript here..."
                                                : "Enter your meeting notes..."
                                        }
                                        value={transcript}
                                        onChange={(e) => setTranscript(e.target.value)}
                                        style={{ minHeight: 240 }}
                                        id="transcript-input"
                                    />
                                </div>
                            )}

                            {error && (
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "var(--radius-sm)",
                                        background: "#fef2f2",
                                        color: "#ef4444",
                                        fontSize: 13,
                                        marginBottom: 12,
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <button
                                className="btn btn-primary"
                                onClick={handleAnalyze}
                                disabled={analyzing || !transcript.trim()}
                                style={{ width: "100%", opacity: analyzing || !transcript.trim() ? 0.6 : 1 }}
                                id="analyze-btn"
                            >
                                {analyzing ? (
                                    <>
                                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                        </svg>
                                        Analyze with AI
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontSize: 14, fontWeight: 700 }}>Past Meetings</span>
                            <span className="badge badge-medium">{meetings.length}</span>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {meetings.length === 0 ? (
                                <div className="empty-state">
                                    <h3>No meetings yet</h3>
                                    <p>Analyzed meetings will appear here.</p>
                                </div>
                            ) : (
                                meetings.map((m) => (
                                    <div
                                        key={m.id}
                                        className="hover-card"
                                        style={{
                                            padding: "12px 20px",
                                            borderBottom: "1px solid var(--border-light)",
                                            cursor: "pointer",
                                            position: "relative",
                                        }}
                                        onClick={() => {
                                            if (m.aiResult) {
                                                try {
                                                    const parsed = JSON.parse(m.aiResult);
                                                    setResult(parsed);
                                                    setTab("insights");
                                                    setActiveMeetingId(m.id);
                                                    // Auto-set per-task overrides from saved result
                                                    const pOvr: Record<string, string> = {};
                                                    const tOvr: Record<string, string> = {};
                                                    for (const epic of (parsed.epics || [])) {
                                                        for (const story of (epic.stories || [])) {
                                                            for (const task of (story.tasks || [])) {
                                                                if (task.suggested_project_id) {
                                                                    const exists = projects.find((p: any) => p.id === task.suggested_project_id);
                                                                    if (exists) pOvr[task.title] = task.suggested_project_id;
                                                                } else if (task.suggested_project_name) {
                                                                    const match = projects.find((p: any) => p.name.toLowerCase().includes(task.suggested_project_name.toLowerCase()));
                                                                    if (match) pOvr[task.title] = match.id;
                                                                }
                                                                if (task.suggested_team_id) {
                                                                    const exists = teams.find((t: any) => t.id === task.suggested_team_id);
                                                                    if (exists) tOvr[task.title] = task.suggested_team_id;
                                                                } else if (task.suggested_team_name) {
                                                                    const match = teams.find((t: any) => t.name.toLowerCase().includes(task.suggested_team_name.toLowerCase()));
                                                                    if (match) tOvr[task.title] = match.id;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    setTaskProjectOverrides(pOvr);
                                                    setTaskTeamOverrides(tOvr);
                                                } catch { }
                                            }
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                                                    {m.inputType} • {m.processedAt ? "✓ Processed" : "Pending"}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                style={{ padding: 4, height: "auto", color: "var(--text-tertiary)" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMeetingToDelete(m);
                                                }}
                                                title="Delete Meeting"
                                            >
                                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                        {m.summary && (
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                                                {m.summary.slice(0, 120)}...
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "insights" && (
                <div>
                    {!result ? (
                        <div className="card">
                            <div className="empty-state">
                                <h3>No insights yet</h3>
                                <p>Upload and analyze a meeting transcript to see AI-extracted insights.</p>
                                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setTab("upload")}>
                                    Go to Upload
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div className="card-body">
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="var(--color-emerald)">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                        </svg>
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>AI Summary</span>
                                    </div>
                                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                        {result.summary}
                                    </p>

                                    {/* Per-task project/team summary */}
                                    {result.project && (
                                        <div style={{ marginTop: 12, padding: 8, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", display: "inline-block" }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Meeting Topic</span>
                                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{result.project}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="metrics-grid" style={{ marginBottom: 16 }}>
                                <div className="metric-card">
                                    <div className="metric-card-label">Epics Found</div>
                                    <div className="metric-card-value">{result.epics.length}</div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-card-label">Stories Extracted</div>
                                    <div className="metric-card-value">{result.epics.reduce((s, e) => s + e.stories.length, 0)}</div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-card-label">Tasks Generated</div>
                                    <div className="metric-card-value">
                                        {result.epics.reduce((s, e) => s + e.stories.reduce((ss, st) => ss + st.tasks.length, 0), 0)}
                                    </div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-card-label">Blockers</div>
                                    <div className="metric-card-value">{result.blockers.length}</div>
                                </div>
                            </div>


                            {/* Global Project Selector — fallback for all accepted tasks */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                                marginBottom: 16, borderRadius: "var(--radius-md)",
                                background: globalProjectId ? "rgba(20, 184, 139, 0.08)" : "var(--bg-secondary)",
                                border: globalProjectId ? "1px solid rgba(20,184,139,0.3)" : "1px solid var(--border-light)"
                            }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={globalProjectId ? "var(--color-emerald)" : "var(--text-tertiary)"}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                                </svg>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", minWidth: 140 }}>
                                    Link tasks to project:
                                </span>
                                <select
                                    className="form-select"
                                    style={{ flex: 1, maxWidth: 280, padding: "6px 10px", fontSize: 13 }}
                                    value={globalProjectId}
                                    onChange={(e) => setGlobalProjectId(e.target.value)}
                                >
                                    <option value="">— Use per-task project settings —</option>
                                    {projects.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                {globalProjectId && (
                                    <span style={{ fontSize: 12, color: "var(--color-emerald)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                        All tasks → {projects.find((p: any) => p.id === globalProjectId)?.name}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleAcceptAll}
                                    id="accept-all-btn"
                                    disabled={result.epics.every(epic => epic.stories.every(story => isStoryAlreadyAccepted(epic, story) || acceptedStories.has(`${epic.title}::${story.title}`)))}
                                    style={{ opacity: result.epics.every(epic => epic.stories.every(story => isStoryAlreadyAccepted(epic, story) || acceptedStories.has(`${epic.title}::${story.title}`))) ? 0.5 : 1 }}
                                >
                                    {result.epics.every(epic => epic.stories.every(story => isStoryAlreadyAccepted(epic, story) || acceptedStories.has(`${epic.title}::${story.title}`))) ? "✓ All Accepted" : "✓ Accept All & Create Tasks"}
                                </button>
                            </div>

                            {result.epics.map((epic, ei) => (
                                <div key={ei} className="card" style={{ marginBottom: 16 }}>
                                    <div className="card-header">
                                        <div>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{epic.title}</span>
                                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                                                {epic.description}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-body" style={{ padding: 0 }}>
                                        {epic.stories.map((story, si) => {
                                            const storyKey = `${epic.title}::${story.title}`;
                                            const accepted = acceptedStories.has(storyKey) || isStoryAlreadyAccepted(epic, story);
                                            return (
                                                <div
                                                    key={si}
                                                    style={{
                                                        padding: "16px 20px",
                                                        borderBottom: "1px solid var(--border-light)",
                                                        opacity: accepted ? 0.6 : 1,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{story.title}</span>
                                                                <span className={`badge badge-${story.priority}`}>{story.priority}</span>
                                                                {accepted && <span className="badge badge-done">✓ Added</span>}
                                                            </div>
                                                            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                                                                {story.description}
                                                            </p>
                                                            <ul className="ai-insight-tasks">
                                                                {story.tasks.map((task, ti) => {
                                                                    const assigneeDetails = getProfileDetails(task.suggested_assignee_id, task.suggested_assignee_name);
                                                                    return (
                                                                        <li key={ti} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                                                            <span className={`status-dot status-dot-backlog`} />
                                                                            <span style={{ flex: 1, minWidth: 200 }}>{task.title}</span>
                                                                            <span className={`badge badge-${task.priority}`} style={{ fontSize: 10 }}>
                                                                                {task.priority}
                                                                            </span>
                                                                            {task.story_points && (
                                                                                <span className="badge" style={{ fontSize: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>
                                                                                    {task.story_points} pts
                                                                                </span>
                                                                            )}

                                                                            {/* Per-task Project dropdown */}
                                                                            <select
                                                                                className="form-select"
                                                                                style={{ padding: "0 4px", fontSize: 10, height: 20, minWidth: 90, background: "transparent", border: "1px solid var(--border-light)" }}
                                                                                value={taskProjectOverrides[task.title] || task.suggested_project_id || ""}
                                                                                onChange={(e) => setTaskProjectOverrides(prev => ({ ...prev, [task.title]: e.target.value }))}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <option value="">Project…</option>
                                                                                {projects.map((p: any) => (
                                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                                ))}
                                                                            </select>

                                                                            {/* Per-task Team dropdown */}
                                                                            <select
                                                                                className="form-select"
                                                                                style={{ padding: "0 4px", fontSize: 10, height: 20, minWidth: 80, background: "transparent", border: "1px solid var(--border-light)" }}
                                                                                value={taskTeamOverrides[task.title] || task.suggested_team_id || ""}
                                                                                onChange={(e) => setTaskTeamOverrides(prev => ({ ...prev, [task.title]: e.target.value }))}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <option value="">Team…</option>
                                                                                {teams.map((t: any) => (
                                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                                ))}
                                                                            </select>

                                                                            {assigneeDetails && (
                                                                                <div style={{
                                                                                    display: "flex", alignItems: "center", gap: 6, fontSize: 11,
                                                                                    padding: "2px 8px", borderRadius: "100px",
                                                                                    background: assigneeDetails.isMatched ? "rgba(20, 184, 139, 0.1)" : "var(--bg-secondary)",
                                                                                    border: assigneeDetails.isMatched ? "1px solid rgba(20, 184, 139, 0.2)" : "1px solid var(--border-light)"
                                                                                }}>
                                                                                    {assigneeDetails.avatar ? (
                                                                                        <img src={assigneeDetails.avatar} alt="Avatar" style={{ width: 14, height: 14, borderRadius: "50%" }} />
                                                                                    ) : (
                                                                                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                                                                        </svg>
                                                                                    )}
                                                                                    {assigneeDetails.name}
                                                                                    {assigneeDetails.isMatched || (task.suggested_assignee_name && assigneeMappings[task.suggested_assignee_name]) ? (
                                                                                        <span style={{ color: "var(--color-emerald)", marginLeft: 4 }}>✓</span>
                                                                                    ) : (
                                                                                        <select
                                                                                            className="form-select"
                                                                                            style={{
                                                                                                padding: "0 4px", fontSize: 10, height: 20, minWidth: 100,
                                                                                                background: "transparent", border: "1px dashed var(--border-light)",
                                                                                                marginLeft: 6
                                                                                            }}
                                                                                            onChange={(e) => {
                                                                                                const profileId = e.target.value;
                                                                                                if (task.suggested_assignee_name) {
                                                                                                    setAssigneeMappings(prev => ({
                                                                                                        ...prev,
                                                                                                        [task.suggested_assignee_name as string]: profileId
                                                                                                    }));
                                                                                                }
                                                                                            }}
                                                                                            value={(task.suggested_assignee_name && assigneeMappings[task.suggested_assignee_name]) || ""}
                                                                                        >
                                                                                            <option value="">Map to...</option>
                                                                                            {profiles.map((p: any) => (
                                                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    )}
                                                                                    {!assigneeDetails.isMatched && !assigneeMappings[task.suggested_assignee_name || ""] && (
                                                                                        <button
                                                                                            className="btn btn-ghost btn-xs"
                                                                                            style={{ fontSize: 10, padding: "0 4px", height: 20, marginLeft: 4 }}
                                                                                            onClick={() => {
                                                                                                setQuickProfileName(task.suggested_assignee_name || "");
                                                                                                setShowQuickProfileModal(true);
                                                                                            }}
                                                                                        >
                                                                                            + Create Profile
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                                                                                <button
                                                                                    className="btn btn-ghost btn-icon btn-xs"
                                                                                    onClick={() => {
                                                                                        setEditingAiTask({ epicIndex: ei, storyIndex: si, taskIndex: ti, task });
                                                                                        setEditTaskTitle(task.title);
                                                                                        setEditTaskDesc(task.description || "");
                                                                                        setEditTaskPriority(task.priority);
                                                                                        setEditTaskAssigneeName(task.suggested_assignee_name || "");
                                                                                    }}
                                                                                    title="Edit Task"
                                                                                >
                                                                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    className="btn btn-ghost btn-icon btn-xs"
                                                                                    style={{ color: "#ef4444" }}
                                                                                    onClick={() => handleDeleteAiTask(ei, si, ti)}
                                                                                    title="Delete Task"
                                                                                >
                                                                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>

                                                                            {task.title && duplicateWarnings[task.title] && (
                                                                                <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>
                                                                                    ⚠️ {duplicateWarnings[task.title]}
                                                                                </span>
                                                                            )}
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        </div>
                                                        {accepted ? (
                                                            <span className="badge badge-done" style={{ marginLeft: 12, flexShrink: 0, padding: "6px 12px" }}>
                                                                ✓ Accepted
                                                            </span>
                                                        ) : (
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleAcceptStory(epic, story)}
                                                                style={{ marginLeft: 12, flexShrink: 0 }}
                                                            >
                                                                Accept
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                {result.decisions.length > 0 && (
                                    <div className="card">
                                        <div className="card-header">
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>📋 Key Decisions</span>
                                        </div>
                                        <div className="card-body">
                                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                                                {result.decisions.map((d, i) => (
                                                    <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                {result.blockers.length > 0 && (
                                    <div className="card">
                                        <div className="card-header">
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>🚧 Blockers</span>
                                        </div>
                                        <div className="card-body">
                                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                                                {result.blockers.map((b, i) => (
                                                    <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5, color: "#ef4444" }}>
                                                        {b}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {result.action_items.length > 0 && (
                                <div className="card" style={{ marginTop: 16 }}>
                                    <div className="card-header">
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>✅ Action Items</span>
                                    </div>
                                    <div className="card-body">
                                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                                            {result.action_items.map((a, i) => (
                                                <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                                                    {a}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {meetingToDelete && (
                <div className="modal-overlay" onClick={() => setMeetingToDelete(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header"><h2>Delete Meeting</h2></div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>{meetingToDelete.title}</strong>?</p>
                            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>This will permanently remove the transcript and AI results.</p>
                        </div>
                        <div className="modal-footer" style={{ marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setMeetingToDelete(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmDeleteMeeting} style={{ background: "var(--status-testing)" }}>Delete Meeting</button>
                        </div>
                    </div>
                </div>
            )}

            {showQuickProfileModal && (
                <div className="modal-overlay" onClick={() => setShowQuickProfileModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2>Quick Create Profile</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowQuickProfileModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    value={quickProfileName}
                                    onChange={(e) => setQuickProfileName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Frontend Developer"
                                    value={quickProfileRole}
                                    onChange={(e) => setQuickProfileRole(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowQuickProfileModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateQuickProfile}>Create & Map</button>
                        </div>
                    </div>
                </div>
            )}

            {editingAiTask && (
                <div className="modal-overlay" onClick={() => setEditingAiTask(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>Edit AI Task Suggestions</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEditingAiTask(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input
                                    className="form-input"
                                    value={editTaskTitle}
                                    onChange={(e) => setEditTaskTitle(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    style={{ height: 80 }}
                                    value={editTaskDesc}
                                    onChange={(e) => setEditTaskDesc(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select
                                        className="form-select"
                                        value={editTaskPriority}
                                        onChange={(e) => setEditTaskPriority(e.target.value)}
                                    >
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Suggested Assignee Name</label>
                                    <input
                                        className="form-input"
                                        value={editTaskAssigneeName}
                                        onChange={(e) => setEditTaskAssigneeName(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditingAiTask(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleUpdateAiTask}>Update Suggestion</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
