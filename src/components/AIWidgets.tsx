import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Activity, Users, LayoutList } from 'lucide-react';

export function AIWorkloadCard({ data }: { data: any }) {
    const percentage = Math.min(100, Math.round(((data.assignedPoints || 0) / (data.capacity || 1)) * 100));

    let statusColor = "var(--color-green)";
    let StatusIcon = CheckCircle2;
    let statusText = "Healthy";

    if (percentage > 85) {
        statusColor = "var(--color-red)";
        StatusIcon = AlertCircle;
        statusText = "Overloaded";
    } else if (percentage > 60) {
        statusColor = "#f59e0b"; // amber
        statusText = "Near Capacity";
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
                background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-light)",
                padding: 24, margin: "16px 0", maxWidth: 450, boxShadow: "0 8px 30px rgba(0,0,0,0.04)"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-indigo)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 16 }}>
                    {data.member.charAt(0)}
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{data.member}</h4>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Users size={12} /> Team Member
                    </span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>Capacity</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{data.capacity} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>pts</span></div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>Tasks</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{data.tasksCount} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>assigned</span></div>
                </div>
            </div>

            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: statusColor, fontSize: 13, fontWeight: 600 }}>
                        <StatusIcon size={16} /> {statusText}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {data.assignedPoints} <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>/ {data.capacity} pts</span>
                    </div>
                </div>
                <div style={{ height: 8, background: "var(--border-light)", borderRadius: 4, overflow: "hidden" }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        style={{ height: "100%", background: statusColor, borderRadius: 4 }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

export function AITaskList({ data, title }: { data: any[], title: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-light)",
                margin: "16px 0", maxWidth: 500, overflow: "hidden"
            }}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", cursor: "pointer", textAlign: "left"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--color-indigo)", padding: 6, borderRadius: 8 }}>
                        <LayoutList size={18} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{title} ({data.length})</span>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown size={18} color="var(--text-tertiary)" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                            {data.map((task, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: "50%", marginTop: 6,
                                        background: task.status === "completed" ? "var(--color-green)" :
                                            task.status === "in-progress" ? "var(--color-indigo)" : "var(--text-tertiary)"
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{task.title}</div>
                                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-secondary)" }}>
                                            <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{task.status.replace("-", " ")}</span>
                                            {task.points && <span>• {task.points} pts</span>}
                                            {task.sprintName && <span>• {task.sprintName}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function AIReasoningLog({ logs }: { logs: string[] }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ marginTop: 12, width: "100%", maxWidth: "70%" }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)"
                }}
            >
                <Activity size={14} />
                Show AI Reasoning ({logs.length} steps)
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown size={14} />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ marginTop: 8, padding: 16, background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border-light)" }}>
                            {logs.map((log, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                    style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i === logs.length - 1 ? 0 : 8 }}
                                >
                                    <CheckCircle2 size={14} color="var(--color-green)" style={{ marginTop: 2 }} />
                                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{log}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
