"use client";

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useToast } from "@/components/Toast";
import { runAssistantAgent, AssistantResponse } from "../actions/ai-assistant";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AIWorkloadCard, AITaskList, AIReasoningLog } from '@/components/AIWidgets';
import { AssistantSidebar } from "@/components/AssistantSidebar";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    proposal?: AssistantResponse;
    status?: "pending" | "executed" | "cancelled";
    tool_logs?: string[];
    displayData?: any[];
}

function AssistantContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionIdFromUrl = searchParams.get("id");

    const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionIdFromUrl);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [agentState, setAgentState] = useState<string>("");
    const [mounted, setMounted] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    // Set mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Query data needed for context and sessions
    const { data, isLoading } = db.useQuery({
        projects: {},
        teams: {},
        profiles: {
            team: {},
            skillProfiles: {}
        },
        sprints: {
            project: {}
        },
        tasks: {
            assignees: {},
            sprint: {},
            project: {},
            assignedTeam: {}
        },
        chatSessions: {},
        chatMessages: {
            session: {}
        }
    });

    const context = useMemo(() => ({
        projects: data?.projects || [],
        teams: data?.teams || [],
        profiles: data?.profiles || [],
        sprints: data?.sprints || [],
        tasks: data?.tasks || [],
    }), [data]);

    const activeSession = data?.chatSessions?.find(s => s.id === activeSessionId);
    const sessionMessages = useMemo(() => {
        if (!activeSessionId) return [];
        return (data?.chatMessages || [])
            .filter(m => m.session?.id === activeSessionId)
            .sort((a, b) => (a.createdAt as any) - (b.createdAt as any))
            .map(m => ({
                ...m,
                proposal: m.proposal ? JSON.parse(m.proposal as string) : undefined,
                tool_logs: m.tool_logs ? JSON.parse(m.tool_logs as string) : undefined,
                displayData: m.displayData ? JSON.parse(m.displayData as string) : undefined
            }));
    }, [data?.chatMessages, activeSessionId]);

    // Handle session switching from URL
    useEffect(() => {
        if (mounted && sessionIdFromUrl !== activeSessionId) {
            setActiveSessionId(sessionIdFromUrl);
        }
    }, [sessionIdFromUrl, mounted]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [sessionMessages, isTyping]);

    const handleSelectSession = (id: string) => {
        setActiveSessionId(id);
        if (mounted) {
            router.push(`/assistant?id=${id}`);
        }
    };

    const handleNewChat = () => {
        setActiveSessionId(null);
        if (mounted) {
            router.push('/assistant');
        }
    };

    const saveMessage = async (sessionId: string, role: "user" | "assistant", content: string, extra?: Partial<Message>) => {
        const messageId = id();
        db.transact([
            db.tx.chatMessages[messageId].update({
                content,
                role,
                proposal: extra?.proposal ? JSON.stringify(extra.proposal) : undefined,
                tool_logs: extra?.tool_logs ? JSON.stringify(extra.tool_logs) : undefined,
                displayData: extra?.displayData ? JSON.stringify(extra.displayData) : undefined,
                createdAt: Date.now()
            }),
            db.tx.chatMessages[messageId].link({ session: sessionId }),
            db.tx.chatSessions[sessionId].update({ updatedAt: Date.now() })
        ]);
        return messageId;
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        let currentSessionId = activeSessionId;
        const userInput = input;
        setInput("");
        setIsTyping(true);
        setAgentState("Thinking...");

        try {
            // 1. Create session if it doesn't exist
            if (!currentSessionId) {
                currentSessionId = id();
                db.transact(
                    db.tx.chatSessions[currentSessionId].update({
                        title: userInput.slice(0, 40) + (userInput.length > 40 ? "..." : ""),
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    })
                );
                setActiveSessionId(currentSessionId);
                if (mounted) {
                    router.push(`/assistant?id=${currentSessionId}`);
                }
            }

            // 2. Save user message
            await saveMessage(currentSessionId, "user", userInput);

            // 3. Run Agent
            const history = sessionMessages.slice(-6).map(m => ({ role: m.role, content: m.content }));
            const result = await runAssistantAgent(userInput, history, context);

            // 4. Save assistant response
            await saveMessage(currentSessionId, "assistant", result.explanation, {
                proposal: result.intent !== "conversation" ? result : undefined,
                tool_logs: result.tool_logs,
                displayData: result.displayData
            });

        } catch (error) {
            console.error(error);
            showToast("Sorry, I hit a snag.", "error");
        } finally {
            setIsTyping(false);
            setAgentState("");
        }
    };

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const handleExecute = (messageId: string, proposal: AssistantResponse) => {
        if (!proposal.data) return;
        try {
            const { intent, data: proposalData } = proposal;

            // Reusable resolver helper to convert names to UUIDs from workspace context
            const resolveId = (provided: string, type: keyof typeof context) => {
                if (!provided || isUUID(provided)) return provided;
                const items = context[type] || [];
                const match = items.find((item: any) =>
                    (item.name || item.title || "").toLowerCase() === provided.toLowerCase()
                );
                return match ? match.id : provided;
            };

            if (intent === "plan_create_project") {
                db.transact(db.tx.projects[id()].update({
                    name: proposalData.name,
                    description: proposalData.description || "",
                    createdAt: Date.now(),
                    color: "var(--color-indigo)"
                }));
                showToast(`Project "${proposalData.name}" created!`);
            }
            else if (intent === "plan_create_sprint") {
                db.transact(db.tx.sprints[id()].update({
                    name: proposalData.name,
                    startDate: proposalData.startDate,
                    endDate: proposalData.endDate,
                    capacity: proposalData.capacity || 40,
                    status: "planning",
                    createdAt: Date.now()
                }));
                showToast(`Sprint "${proposalData.name}" scheduled.`);
            }
            else if (intent === "plan_update_member") {
                const memberId = resolveId(proposalData.memberId, 'profiles');
                if (!isUUID(memberId)) {
                    showToast(`Invalid ID format.`, "error");
                    return;
                }
                const updates: any = {};
                if (proposalData.name) updates.name = proposalData.name;
                if (proposalData.role) updates.role = proposalData.role;
                if (proposalData.skills) updates.skills = proposalData.skills;
                if (proposalData.capacity) updates.capacity = proposalData.capacity;

                const teamId = resolveId(proposalData.teamId, 'teams');
                const txs: any[] = [db.tx.profiles[memberId].update(updates)];
                if (teamId && isUUID(teamId)) {
                    txs.push(db.tx.profiles[memberId].link({ team: teamId }));
                }

                db.transact(txs);
                showToast(`Updated profile for ${proposalData.memberName || proposalData.name}.`);
            }
            else if (intent === "plan_unassign_task") {
                const taskId = resolveId(proposalData.taskId, 'tasks');
                const memberId = resolveId(proposalData.memberId, 'profiles');

                if (!isUUID(taskId) || !isUUID(memberId)) {
                    showToast(`Could not resolve task or member.`, "error");
                    return;
                }

                db.transact([
                    db.tx.tasks[taskId].unlink({ assignees: memberId })
                ]);
                showToast(`Removed from task!`);
            }
            else if (intent === "plan_assign_task") {
                const taskId = resolveId(proposalData.taskId, 'tasks');
                const memberId = resolveId(proposalData.recommendedAssigneeId, 'profiles');

                if (!isUUID(taskId) || !isUUID(memberId)) {
                    showToast(`Could not resolve task or member.`, "error");
                    return;
                }

                db.transact([
                    db.tx.tasks[taskId].update({ status: "in_progress" }),
                    db.tx.tasks[taskId].link({ assignees: memberId })
                ]);
                showToast(`Task assigned!`);
            }
            else if (intent === "plan_create_task") {
                const taskId = id();
                const projectId = resolveId(proposalData.projectId, 'projects');
                const sprintId = resolveId(proposalData.sprintId, 'sprints');
                const teamId = resolveId(proposalData.teamId, 'teams');
                const assigneeId = resolveId(proposalData.assigneeId, 'profiles');

                const txs: any[] = [
                    db.tx.tasks[taskId].update({
                        title: proposalData.title,
                        description: proposalData.description || "",
                        storyPoints: proposalData.storyPoints || 3,
                        priority: proposalData.priority || "medium",
                        status: "ready",
                        createdAt: new Date()
                    })
                ];

                if (projectId && isUUID(projectId)) txs.push(db.tx.tasks[taskId].link({ project: projectId }));
                if (sprintId && isUUID(sprintId)) txs.push(db.tx.tasks[taskId].link({ sprint: sprintId }));
                if (teamId && isUUID(teamId)) txs.push(db.tx.tasks[taskId].link({ assignedTeam: teamId }));
                if (assigneeId && isUUID(assigneeId)) txs.push(db.tx.tasks[taskId].link({ assignees: assigneeId }));

                db.transact(txs);
                showToast(`Task created.`);
            }
            else if (intent === "plan_create_team_member") {
                const profileId = id();
                const teamId = resolveId(proposalData.teamId, 'teams');
                const txs: any[] = [
                    db.tx.profiles[profileId].update({
                        name: proposalData.name,
                        email: proposalData.email,
                        role: proposalData.role,
                        skills: proposalData.skills || "",
                        capacity: proposalData.capacity || 40,
                        status: "Available",
                        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(proposalData.name)}`,
                        createdAt: Date.now()
                    })
                ];
                if (teamId && isUUID(teamId)) txs.push(db.tx.profiles[profileId].link({ team: teamId }));
                db.transact(txs);
                showToast(`Member added.`);
            }
            else if (intent === "plan_create_team") {
                db.transact(db.tx.teams[id()].update({
                    name: proposalData.name,
                    createdAt: Date.now()
                }));
                showToast(`Team created.`);
            }

            // Update message status in localized state and DB
            db.transact(db.tx.chatMessages[messageId].update({ status: "executed" }));
        } catch (err) {
            console.error(err);
            showToast("Execution failed.", "error");
        }
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
            <div style={{ flexShrink: 0 }}>
                <AssistantSidebar
                    sessions={data?.chatSessions || []}
                    activeSessionId={activeSessionId}
                    onSelectSession={handleSelectSession}
                    onNewChat={handleNewChat}
                />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div>
                            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 28 }}>🤖</span> James <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)" }}>Operations Copilot</span>
                            </h2>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {agentState && (
                                <div style={{ fontSize: 13, color: "var(--color-indigo)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                                    <div className="dot-blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-indigo)" }} />
                                    {agentState}
                                </div>
                            )}
                            <div className="badge" style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--color-indigo)" }}>v3.5 Persistent</div>
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-secondary)", borderRadius: "24px", border: "1px solid var(--border-light)", boxShadow: "0 10px 40px rgba(0,0,0,0.04)" }}>
                        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: 32 }}>
                            {sessionMessages.length === 0 && !isTyping && (
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-tertiary)", gap: 16 }}>
                                    <div style={{ fontSize: 48 }}>👋</div>
                                    <div>
                                        <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Ready to help, Dinakar!</h3>
                                        <p style={{ maxWidth: 300, fontSize: 14 }}>Try asking me to assign a task, create a project, or update a team member's profile.</p>
                                    </div>
                                </div>
                            )}

                            {sessionMessages.map((m: any) => (
                                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "slide-in 0.3s ease-out" }}>
                                    {m.role === "assistant" && (
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 6, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>James</div>
                                    )}

                                    {(!m.displayData || m.displayData.length === 0 || m.role === "user") && (
                                        <div className="markdown-body" style={{
                                            maxWidth: "80%", padding: "16px 20px", borderRadius: m.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                                            background: m.role === "user" ? "var(--color-indigo)" : "var(--bg-primary)",
                                            color: m.role === "user" ? "white" : "var(--text-primary)",
                                            border: m.role === "user" ? "none" : "1px solid var(--border-light)",
                                            fontSize: 15, lineHeight: 1.6, boxShadow: m.role === "user" ? "0 8px 16px rgba(139, 92, 246, 0.15)" : "0 4px 12px rgba(0,0,0,0.03)",
                                            wordBreak: "break-word"
                                        }}>
                                            {m.role === "assistant" ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {m.content}
                                                </ReactMarkdown>
                                            ) : (
                                                m.content
                                            )}
                                        </div>
                                    )}

                                    <div style={{
                                        width: "100%",
                                        display: "flex",
                                        gap: 16,
                                        overflowX: "auto",
                                        padding: "8px 4px 20px 4px",
                                        margin: "8px -4px 0 -4px",
                                        scrollbarWidth: "none"
                                    }} className="hide-scrollbar">
                                        {m.displayData && m.displayData.map((widget: any, i: number) => (
                                            <div key={i} style={{ minWidth: widget.type === "workload" ? 340 : "100%", flexShrink: 0 }}>
                                                {widget.type === "workload" && <AIWorkloadCard data={widget.data} />}
                                                {widget.type === "task_list" && <AITaskList data={widget.data} title={widget.title} />}
                                            </div>
                                        ))}
                                    </div>

                                    {m.tool_logs && m.tool_logs.length > 0 && <AIReasoningLog logs={m.tool_logs} />}

                                    {m.proposal && m.role === "assistant" && (
                                        <div style={{
                                            marginTop: 16, width: "100%", maxWidth: 500, background: "var(--bg-primary)", border: "1px solid var(--border-light)",
                                            borderRadius: "20px", padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", animation: "scale-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--color-indigo)", boxShadow: "0 0 15px var(--color-indigo)" }} />
                                                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>PROPOSAL: {m.proposal.intent.replace("plan_", "").toUpperCase()}</span>
                                            </div>

                                            <div style={{ background: "var(--bg-secondary)", borderRadius: "16px", border: "1px solid var(--border-light)", padding: "20px", marginBottom: 24 }}>
                                                {m.proposal.intent === "plan_update_member" ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                                        <div style={{ fontSize: 14 }}>Target: <strong style={{ color: "var(--color-indigo)" }}>{m.proposal.data.memberName}</strong></div>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                                            {m.proposal.data.role && (
                                                                <div style={{ background: "var(--bg-primary)", padding: 12, borderRadius: 12, border: "1px solid var(--border-light)" }}>
                                                                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>NEW ROLE</div>
                                                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.proposal.data.role}</div>
                                                                </div>
                                                            )}
                                                            {m.proposal.data.capacity && (
                                                                <div style={{ background: "var(--bg-primary)", padding: 12, borderRadius: 12, border: "1px solid var(--border-light)" }}>
                                                                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>CAPACITY</div>
                                                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.proposal.data.capacity} pts</div>
                                                                </div>
                                                            )}
                                                            {m.proposal.data.teamId && (
                                                                <div style={{ background: "rgba(139, 92, 246, 0.05)", padding: 12, borderRadius: 12, border: "1px solid rgba(139, 92, 246, 0.2)", gridColumn: "span 2" }}>
                                                                    <div style={{ fontSize: 10, color: "var(--color-indigo)", marginBottom: 4 }}>TEAM ASSIGNMENT</div>
                                                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-indigo)" }}>
                                                                        {context.teams.find(t => t.id === m.proposal.data.teamId)?.name || "New Team Assignment"}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <pre style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                                                        {JSON.stringify(m.proposal.data, null, 2)}
                                                    </pre>
                                                )}
                                            </div>

                                            {m.status === "executed" ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-green)", fontSize: 14, fontWeight: 700, background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "12px", justifyContent: "center" }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17L4 12" /></svg>
                                                    Successfully Executed
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 12 }}>
                                                    <button className="btn btn-primary" style={{ flex: 1, borderRadius: 12, padding: "12px" }} onClick={() => handleExecute(m.id, m.proposal!)}>Confirm Change</button>
                                                    <button className="btn btn-ghost" style={{ borderRadius: 12 }} onClick={() => db.transact(db.tx.chatMessages[m.id].update({ proposal: undefined }))}>Dismiss</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isTyping && (
                                <div style={{ display: "flex", gap: 8, padding: "16px 24px", background: "var(--bg-primary)", borderRadius: "20px", width: "fit-content", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                                    <div className="dot-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-indigo)" }} />
                                    <div className="dot-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-indigo)", animationDelay: "0.2s" }} />
                                    <div className="dot-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-indigo)", animationDelay: "0.4s" }} />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: "32px", background: "var(--bg-primary)", borderTop: "1px solid var(--border-light)" }}>
                            <div style={{ display: "flex", gap: 16, position: "relative" }}>
                                <input
                                    className="form-input"
                                    style={{ borderRadius: "32px", padding: "16px 32px", fontSize: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-light)", transition: "all 0.2s" }}
                                    placeholder="What's on your mind?"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                />
                                <button className="btn btn-primary" style={{ borderRadius: "50%", width: 56, height: 56, padding: 0, flexShrink: 0, boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)" }} onClick={handleSend} disabled={!input.trim() || isTyping}>
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <style jsx>{`
                @keyframes slide-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                .dot-blink { animation: blink 1.4s infinite both; }
                @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
                .markdown-body :global(p) { margin-bottom: 0; }
                .markdown-body :global(ul) { margin-top: 8px; margin-bottom: 0; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            </div>
        </div>
    );
}

export default function AssistantPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20 }}>Loading Assistant...</div>}>
            <AssistantContent />
        </Suspense>
    );
}
