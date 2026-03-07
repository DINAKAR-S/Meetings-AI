"use client";

import React, { useState, useMemo } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Task {
    id: string;
    title: string;
    priority: string;
    storyPoints?: number;
    assigneeId?: string;
}

interface Profile {
    id: string;
    name: string;
    avatarUrl?: string;
    capacity?: number;
}

interface AiSprintPlannerBoardProps {
    tasks: Task[];
    profiles: Profile[];
    initialAssignments: { taskId: string; assigneeId: string; reasoning?: string }[];
    initialUnassignedIds: string[];
    sprintCapacity: number;
    onApply: (assignments: { taskId: string; assigneeId: string }[]) => void;
    onCancel: () => void;
}

// Draggable Task Card
function SortableTaskCard({ task, reasoning }: { task: Task; reasoning?: string }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        padding: "12px",
        background: "var(--bg-primary)",
        borderRadius: "8px",
        border: "1px solid var(--border-light)",
        marginBottom: "8px",
        cursor: "grab",
        fontSize: "13px",
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : "none",
        zIndex: isDragging ? 2 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span>{task.title}</span>
                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--bg-secondary)", borderRadius: 4, color: "var(--text-tertiary)" }}>
                    {task.storyPoints || 3} pts
                </span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`badge badge-${task.priority}`} style={{ fontSize: 10, padding: "1px 6px" }}>{task.priority}</span>
            </div>
            {reasoning && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 4 }}>
                    <span style={{ color: "var(--color-indigo)" }}>✨</span>
                    {reasoning}
                </div>
            )}
        </div>
    );
}

// Droppable Column
function PlannerColumn({ id, title, tasks, profiles, activeId, totalPoints, capacity, reasoningMap }: any) {
    const { setNodeRef } = useSortable({ id });

    const isOverCapacity = capacity && totalPoints > capacity;

    return (
        <div
            ref={setNodeRef}
            style={{
                flex: 1,
                minWidth: "260px",
                background: "var(--bg-secondary)",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                maxHeight: "100%",
                border: isOverCapacity ? "1px solid #ef4444" : "1px solid var(--border-light)",
                transition: "border-color 0.2s"
            }}
        >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h4>
                    {capacity && (
                        <div style={{ fontSize: 12, marginTop: 4, color: isOverCapacity ? "#ef4444" : "var(--text-tertiary)" }}>
                            {totalPoints} / {capacity} pts {isOverCapacity && "⚠ Over capacity"}
                        </div>
                    )}
                </div>
                <span className="badge badge-medium">{tasks.length}</span>
            </div>

            {/* Progress Bar for Capacity */}
            {capacity && (
                <div style={{ height: 4, background: "rgba(0,0,0,0.05)", width: "100%" }}>
                    <div
                        style={{
                            height: "100%",
                            width: `${Math.min(100, (totalPoints / capacity) * 100)}%`,
                            background: isOverCapacity ? "#ef4444" : "var(--color-indigo)",
                            transition: "width 0.3s ease, background-color 0.3s ease"
                        }}
                    />
                </div>
            )}

            <div style={{ padding: "12px", overflowY: "auto", flex: 1 }}>
                <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task: any) => (
                        <SortableTaskCard key={task.id} task={task} reasoning={reasoningMap[task.id]} />
                    ))}
                </SortableContext>
                {tasks.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)", fontSize: 12, border: "2px dashed var(--border-light)", borderRadius: 8 }}>
                        Drop tasks here
                    </div>
                )}
            </div>
        </div>
    );
}

export function AiSprintPlannerBoard({
    tasks,
    profiles,
    initialAssignments,
    initialUnassignedIds,
    sprintCapacity,
    onApply,
    onCancel
}: AiSprintPlannerBoardProps) {
    // Initializing state: map of columnId -> taskIds
    const [columns, setColumns] = useState<Record<string, string[]>>(() => {
        const cols: Record<string, string[]> = {
            "backlog": initialUnassignedIds
        };
        profiles.forEach(p => {
            cols[p.id] = initialAssignments
                .filter(a => a.assigneeId === p.id)
                .map(a => a.taskId);
        });
        return cols;
    });

    const [activeId, setActiveId] = useState<string | null>(null);

    // Map of taskId -> reasoning
    const reasoningMap = useMemo(() => {
        const map: Record<string, string> = {};
        initialAssignments.forEach(a => {
            if (a.reasoning) map[a.taskId] = a.reasoning;
        });
        return map;
    }, [initialAssignments]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findColumn = (id: string) => {
        if (id in columns) return id;
        return Object.keys(columns).find(key => columns[key].includes(id));
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activeCol = findColumn(activeId);
        const overCol = findColumn(overId);

        if (!activeCol || !overCol || activeCol === overCol) return;

        setColumns(prev => {
            const activeItems = prev[activeCol];
            const overItems = prev[overCol];

            const activeIndex = activeItems.indexOf(activeId);
            const overIndex = overId in prev ? overItems.length : overItems.indexOf(overId);

            return {
                ...prev,
                [activeCol]: activeItems.filter(id => id !== activeId),
                [overCol]: [
                    ...overItems.slice(0, overIndex),
                    activeId,
                    ...overItems.slice(overIndex)
                ]
            };
        });
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        const activeId = active.id;
        const overId = over.id;

        const activeCol = findColumn(activeId);
        const overCol = findColumn(overId);

        if (activeCol && overCol && activeCol === overCol) {
            const activeIndex = columns[activeCol].indexOf(activeId);
            const overIndex = columns[overCol].indexOf(overId);

            if (activeIndex !== overIndex) {
                setColumns(prev => ({
                    ...prev,
                    [activeCol]: arrayMove(prev[activeCol], activeIndex, overIndex)
                }));
            }
        }

        setActiveId(null);
    };

    const getColumnTotalPoints = (colId: string) => {
        return columns[colId].reduce((acc, taskId) => {
            const task = tasks.find(t => t.id === taskId);
            return acc + (task?.storyPoints || 3);
        }, 0);
    };

    const handleApply = () => {
        const finalAssignments: { taskId: string; assigneeId: string }[] = [];
        Object.entries(columns).forEach(([colId, taskIds]) => {
            if (colId !== "backlog") {
                taskIds.forEach(taskId => {
                    finalAssignments.push({ taskId, assigneeId: colId });
                });
            }
        });
        onApply(finalAssignments);
    };

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 20 }}>
            {/* Planner Board Wrapper */}
            <div style={{ display: "flex", gap: 16, flex: 1, overflowX: "auto", paddingBottom: 8, minHeight: 400 }}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    {/* Backlog Column */}
                    <PlannerColumn
                        id="backlog"
                        title="Backlog / Deferred"
                        tasks={columns["backlog"].map(id => tasks.find(t => t.id === id)).filter(Boolean)}
                        reasoningMap={reasoningMap}
                    />

                    {/* Developer Columns */}
                    {profiles.map(p => (
                        <PlannerColumn
                            key={p.id}
                            id={p.id}
                            title={p.name}
                            tasks={columns[p.id].map(id => tasks.find(t => t.id === id)).filter(Boolean)}
                            totalPoints={getColumnTotalPoints(p.id)}
                            capacity={p.capacity || 20}
                            reasoningMap={reasoningMap}
                        />
                    ))}

                    <DragOverlay dropAnimation={{
                        sideEffects: defaultDropAnimationSideEffects({
                            styles: {
                                active: {
                                    opacity: '0.5',
                                },
                            },
                        }),
                    }}>
                        {activeTask ? (
                            <div style={{
                                padding: "12px",
                                background: "var(--bg-primary)",
                                borderRadius: "8px",
                                border: "1px solid var(--color-indigo)",
                                fontSize: "13px",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                                width: 260
                            }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{activeTask.title}</div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <span className={`badge badge-${activeTask.priority}`} style={{ fontSize: 10 }}>{activeTask.priority}</span>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{activeTask.storyPoints || 3} pts</span>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid var(--border-light)" }}>
                <button
                    className="btn btn-ghost"
                    onClick={() => {
                        const cols: Record<string, string[]> = { "backlog": initialUnassignedIds };
                        profiles.forEach(p => {
                            cols[p.id] = initialAssignments
                                .filter(a => a.assigneeId === p.id)
                                .map(a => a.taskId);
                        });
                        setColumns(cols);
                    }}
                    style={{ fontSize: 13, color: "var(--color-indigo)" }}
                >
                    🔄 Reset to AI Suggestion
                </button>
                <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        style={{ background: "var(--color-emerald)", borderColor: "var(--color-emerald)" }}
                    >
                        ✓ Apply Modified Plan
                    </button>
                </div>
            </div>
        </div>
    );
}
