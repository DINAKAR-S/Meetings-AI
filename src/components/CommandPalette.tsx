"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/db';
import { runAssistantAgent, AssistantResponse } from '@/app/actions/ai-assistant';
import { useToast } from './Toast';
import { id } from '@instantdb/react';
import { Search, Sparkles, Loader2, ArrowRight } from 'lucide-react';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [result, setResult] = useState<AssistantResponse | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Fetch context globally for the Command Palette
    const { data } = db.useQuery({
        projects: {},
        teams: {},
        profiles: {},
        sprints: {},
        tasks: {},
        developerSkillProfiles: {}
    });

    const context = {
        projects: data?.projects || [],
        teams: data?.teams || [],
        profiles: data?.profiles || [],
        sprints: data?.sprints || [],
        tasks: data?.tasks || [],
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setResult(null);
                setInput("");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;

        setIsThinking(true);
        setResult(null);

        try {
            const res = await runAssistantAgent(input, [], context);
            setResult(res);
        } catch (error) {
            showToast("Failed to process command.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    const handleExecute = () => {
        if (!result || !result.data) return;
        try {
            const { intent, data } = result;
            if (intent === "plan_create_sprint") {
                db.transact(db.tx.sprints[id()].update({
                    name: data.name, startDate: data.startDate, endDate: data.endDate,
                    capacity: data.capacity, status: "planning"
                }));
                showToast(`Sprint "${data.name}" created!`);
            } else if (intent === "plan_update_capacity") {
                const member = context.profiles.find((p: any) => p.name === data.memberName);
                if (member) {
                    db.transact(db.tx.profiles[member.id].update({ capacity: data.newValue }));
                    showToast(`Updated capacity to ${data.newValue}.`);
                }
            } else if (intent === "plan_assign_task") {
                const task = context.tasks.find((t: any) => t.id === data.taskId);
                const member = context.profiles.find((p: any) => p.name === data.recommendedAssigneeName);
                if (task && member) {
                    db.transact([
                        db.tx.tasks[task.id].update({ status: "in_progress" }),
                        db.tx.tasks[task.id].link({ assignees: member.id })
                    ]);
                    showToast(`Assigned task to ${member.name}.`);
                }
            }
            setIsOpen(false);
            setResult(null);
            setInput("");
        } catch (error) {
            showToast("Failed to execute.", "error");
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            zIndex: 9999, display: "flex", justifyContent: "center", paddingTop: "10vh"
        }} onClick={() => setIsOpen(false)}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                    background: "var(--bg-primary)", width: "100%", maxWidth: 640,
                    borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
                    overflow: "hidden", border: "1px solid var(--border-light)"
                }}
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border-light)" }}>
                    {isThinking ? (
                        <Loader2 className="animate-spin" style={{ color: "var(--color-indigo)", marginRight: 16 }} size={24} />
                    ) : (
                        <Search style={{ color: "var(--text-tertiary)", marginRight: 16 }} size={24} />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask SprintMind AI to manage your workspace..."
                        style={{
                            flex: 1, border: "none", outline: "none", fontSize: 18,
                            background: "transparent", color: "var(--text-primary)", fontWeight: 500
                        }}
                    />
                    <div style={{ fontSize: 12, background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: 6, color: "var(--text-tertiary)", fontWeight: 600 }}>
                        ESC
                    </div>
                </form>

                <div style={{ padding: 24, minHeight: 200, background: "var(--bg-secondary)" }}>
                    {!result && !isThinking ? (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" }}>Quick Actions</div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                {["Create a new sprint next week", "Who is overloaded right now?", "Show me Dinakar's tasks"].map((suggestion, i) => (
                                    <button
                                        key={i} onClick={() => setInput(suggestion)}
                                        style={{
                                            background: "var(--bg-primary)", border: "1px solid var(--border-light)",
                                            padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                                            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                            color: "var(--text-secondary)"
                                        }}
                                    >
                                        <Sparkles size={14} color="var(--color-indigo)" />
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : result ? (
                        <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--color-indigo)", padding: 20 }}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                <div style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--color-indigo)", padding: 8, borderRadius: 8, height: "fit-content" }}>
                                    <Sparkles size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                                        {result.intent !== "conversation" ? "AI Action Proposal" : "AI Insight"}
                                    </h4>
                                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                        {result.explanation}
                                    </p>
                                </div>
                            </div>

                            {result.intent !== "conversation" && (
                                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16, marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                    <button onClick={() => setResult(null)} style={{ background: "none", border: "1px solid var(--border-light)", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
                                        Dismiss
                                    </button>
                                    <button onClick={handleExecute} style={{ background: "var(--color-indigo)", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                        Apply Action <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 150, color: "var(--text-tertiary)" }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>AI is processing your request...</div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
