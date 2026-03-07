"use client";

import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useState } from "react";

export default function DashboardPage() {
  const { isLoading, error, data } = db.useQuery({
    projects: {},
    sprints: {},
    tasks: {},
    meetings: {},
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

  const activeSprints = sprints.filter((s) => s.status === "active");
  const tasksInProgress = tasks.filter((t) => t.status === "in_progress");
  const tasksDone = tasks.filter((t) => t.status === "done");
  const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const donePoints = tasksDone.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const velocity = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  return (
    <div>
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
            {tasksDone.length} completed
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
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="var(--color-emerald)">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            AI Recommendations
          </span>
        </div>
        <div className="card-body">
          {tasks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Upload a meeting transcript to get AI-powered recommendations for your sprint.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {tasksInProgress.length > 3 && (
                <div className="ai-insight-card">
                  <h4>⚠️ High WIP</h4>
                  <p>You have {tasksInProgress.length} tasks in progress. Consider finishing some before starting new ones.</p>
                </div>
              )}
              {tasks.filter((t) => t.priority === "critical" && t.status !== "done").length > 0 && (
                <div className="ai-insight-card">
                  <h4>🔴 Critical Tasks</h4>
                  <p>{tasks.filter((t) => t.priority === "critical" && t.status !== "done").length} critical tasks still open.</p>
                </div>
              )}
              <div className="ai-insight-card">
                <h4>📊 Sprint Health</h4>
                <p>{velocity >= 70 ? "Sprint is on track!" : "Sprint progress is below target. Consider reprioritizing."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
