"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState } from "react";
import { SprintHealthDashboard } from "@/components/SprintHealthDashboard";
import Link from "next/link";

export default function DashboardPage() {
  const { isLoading, error, data } = db.useQuery({
    projects: {},
    sprints: {},
    tasks: { sprint: {}, assignees: {} },
    meetings: {},
    profiles: {},
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  const projects = data?.projects || [];
  const sprints = data?.sprints || [];
  const tasks = data?.tasks || [];
  const meetings = data?.meetings || [];
  const profiles = data?.profiles || [];

  const activeSprint = sprints.find((s) => s.status === "active");
  const activeSprintTasks = activeSprint ? tasks.filter(t => t.sprint?.id === activeSprint.id) : [];

  const activeSprints = sprints.filter((s) => s.status === "active");
  const ACTIVE_STATUSES = ["ready", "doing", "in_progress", "review", "testing"];
  const tasksInProgress = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));

  const totalPoints = activeSprintTasks.reduce((sum, t) => sum + (t.storyPoints || 3), 0);
  const donePoints = activeSprintTasks.filter(t => t.status === "done").reduce((sum, t) => sum + (t.storyPoints || 3), 0);
  const velocity = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Good Afternoon, Dinakar</h2>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0" }}>Here's what's happening with your projects today.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/meetings" className="btn btn-secondary">
            🤖 Upload Meeting
          </Link>
          <Link href="/backlog" className="btn btn-primary">
            ➕ New Task
          </Link>
        </div>
      </div>

      {/* AI Sprint Health Widget */}
      {activeSprint && (
        <div style={{ marginBottom: 24 }}>
          <SprintHealthDashboard
            sprint={activeSprint}
            tasks={tasks.filter(t => t.sprint?.id === activeSprint.id)}
            profiles={profiles}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-label">Total Projects</div>
          <div className="metric-card-value">{projects.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Active Sprints</div>
          <div className="metric-card-value">{activeSprints.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Tasks In Progress</div>
          <div className="metric-card-value">{tasksInProgress.length}</div>
          <div className="metric-card-change positive">
            {activeSprintTasks.filter(t => t.status === "done").length} completed
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Sprint Velocity</div>
          <div className="metric-card-value">{velocity}%</div>
          <div style={{ marginTop: 8 }}>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${velocity}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent Tasks */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 14, fontWeight: 700 }}>Recent Tasks</span>
            <span className="badge badge-medium">{tasks.length} total</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {tasks.length === 0 ? (
              <div className="empty-state">
                <h3>No tasks yet</h3>
                <p>Upload a meeting or create tasks manually to get started.</p>
              </div>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`status-dot status-dot-${task.status}`} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{task.title}</span>
                  </div>
                  <span className={`badge badge-${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 14, fontWeight: 700 }}>Recent Meetings</span>
            <span className="badge badge-medium">{meetings.length} total</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {meetings.length === 0 ? (
              <div className="empty-state">
                <h3>No meetings yet</h3>
                <p>Go to the Meetings page to upload a transcript and extract insights.</p>
              </div>
            ) : (
              meetings.slice(0, 5).map((meeting) => (
                <div
                  key={meeting.id}
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{meeting.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {meeting.inputType} • {meeting.processedAt ? "Processed" : "Pending"}
                    </div>
                  </div>
                  <span className={`badge ${meeting.processedAt ? "badge-done" : "badge-backlog"}`}>
                    {meeting.processedAt ? "Analyzed" : "Pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card" style={{ marginTop: 24, border: "none", boxShadow: "var(--shadow-md)", background: "linear-gradient(to bottom right, #ffffff, #f9fdfa)" }}>
        <div className="card-header" style={{ background: "transparent" }}>
          <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span> AI Sprint Intelligence
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-emerald)", textTransform: "uppercase" }}>Real-time Analysis</span>
        </div>
        <div className="card-body">
          {tasks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "20px 0" }}>
              Upload a meeting transcript to generate AI project intelligence.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {tasksInProgress.length > 3 && (
                <div className="ai-insight-card" style={{ background: "white", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 4 }}>RESOURCE OVERLOAD</div>
                  <h4 style={{ fontSize: 14, fontWeight: 700 }}>⚠️ High WIP Detected</h4>
                  <p style={{ fontSize: 12 }}>You have {tasksInProgress.length} tasks in progress. Throughput may decrease. Recommend focusing on "Done" status.</p>
                </div>
              )}
              {tasks.filter((t) => t.priority === "critical" && t.status !== "done").length > 0 && (
                <div className="ai-insight-card" style={{ background: "white", borderLeft: "4px solid #ef4444" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>CRITICAL RISK</div>
                  <h4 style={{ fontSize: 14, fontWeight: 700 }}>🔴 Performance Blockers</h4>
                  <p style={{ fontSize: 12 }}>{tasks.filter((t) => t.priority === "critical" && t.status !== "done").length} critical tasks remain open. Sprint goals are at risk.</p>
                </div>
              )}
              <div className="ai-insight-card" style={{ background: "white", borderLeft: "4px solid var(--color-emerald)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-emerald)", marginBottom: 4 }}>PROJECT HEALTH</div>
                <h4 style={{ fontSize: 14, fontWeight: 700 }}>📊 Velocity Insight</h4>
                <p style={{ fontSize: 12 }}>{velocity >= 70 ? "Team velocity is optimal. Current projection: 100% completion." : "Current velocity is trending lower than historical average."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
