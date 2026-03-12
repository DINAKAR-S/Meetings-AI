"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

export function SprintHealthDashboard({ sprint, tasks, profiles }: { sprint: any, tasks: any[], profiles: any[] }) {
    const { showToast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    if (!sprint) {
        return null;
    }

    const completedTasks = tasks.filter(t => t.status === "done");
    const blockedTasks = tasks.filter(t => t.status === "blocked");
    const pointsCompleted = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 3), 0);
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 3), 0);
    const progressPercent = totalPoints > 0 ? Math.round((pointsCompleted / totalPoints) * 100) : 0;

    const handleAnalyzeRisk = async () => {
        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const response = await fetch("/api/sprints/risk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sprintName: sprint.name,
                    tasks: tasks,
                    profiles: profiles
                })
            });
            const res = await response.json();
            if (res.success) {
                setAnalysisResult(res.data);
            } else {
                showToast(res.error || "Failed to analyze risk");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to analyze risk");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getHealthColor = (score: string) => {
        if (score === "On Track") return "var(--color-emerald)";
        if (score === "Medium Risk") return "var(--color-amber)";
        if (score === "High Risk") return "var(--color-rose)";
        return "var(--text-secondary)";
    };

    const getHealthBgColor = (score: string) => {
        if (score === "On Track") return "rgba(16, 185, 129, 0.1)";
        if (score === "Medium Risk") return "rgba(245, 158, 11, 0.1)";
        if (score === "High Risk") return "rgba(244, 63, 94, 0.1)";
        return "var(--bg-secondary)";
    };

    return (
        <div style={{
            background: "var(--bg-primary)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-light)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            marginBottom: 24,
            overflow: "hidden"
        }}>
            {/* Header / Stats Row */}
            <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(to right, rgba(139, 92, 246, 0.03), transparent)"
            }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-indigo)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                        Active Sprint Overview
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                        {sprint.name} {sprint.endDate ? <span style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 500 }}>ends {sprint.endDate}</span> : ""}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Progress</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{progressPercent}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Velocity</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                            {pointsCompleted}<span style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 500 }}> / {totalPoints} pts</span>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Blockers</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: blockedTasks.length > 0 ? "var(--color-rose)" : "var(--text-primary)" }}>
                            {blockedTasks.length}
                        </div>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleAnalyzeRisk}
                    disabled={isAnalyzing}
                    style={{
                        background: "var(--color-indigo)",
                        borderColor: "var(--color-indigo)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)"
                    }}
                >
                    {isAnalyzing ? (
                        <>
                            <div className="spinner" style={{ width: 14, height: 14, borderTopColor: "white", borderWidth: 2 }} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            ✨ Identify Risks
                        </>
                    )}
                </button>
            </div>

            {/* AI Analysis Panel */}
            {analysisResult && (
                <div style={{ padding: 24, background: "var(--bg-secondary)", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32, animation: "fadeIn 0.3s ease-out" }}>

                    {/* Left: Health Score */}
                    <div style={{
                        background: "var(--bg-primary)",
                        padding: 24,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center"
                    }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                            AI Health Score
                        </div>
                        <div style={{
                            padding: "8px 20px",
                            borderRadius: "100px",
                            background: getHealthBgColor(analysisResult.healthScore),
                            color: getHealthColor(analysisResult.healthScore),
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 16
                        }}>
                            {analysisResult.healthScore}
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                            {analysisResult.riskSummary}
                        </p>
                    </div>

                    {/* Right: Mitigations */}
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-indigo)" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Suggested Mitigations
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {analysisResult.mitigations?.map((mitigation: string, i: number) => (
                                <div key={i} style={{
                                    padding: "12px 16px",
                                    background: "var(--bg-primary)",
                                    borderLeft: "3px solid var(--color-indigo)",
                                    borderRadius: "4px 8px 8px 4px",
                                    fontSize: 13,
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.5,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                                }}>
                                    {mitigation}
                                </div>
                            ))}
                            {(!analysisResult.mitigations || analysisResult.mitigations.length === 0) && (
                                <div style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                                    No immediate actions required. Ensure the team remains unblocked.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
