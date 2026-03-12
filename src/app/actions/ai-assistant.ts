"use server";

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface AssistantResponse {
    intent: string;
    data: any;
    explanation: string;
    confidence: number;
    tool_logs?: string[];
    displayData?: any[]; // For structured widgets
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    // --- READ TOOLS ---
    {
        type: "function",
        function: {
            name: "get_member_data",
            description: "Retrieve profile, team, and capacity information for a team member by name.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" }
                },
                required: ["name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_active_sprints",
            description: "Retrieve a list of all active or planned sprints.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_projects",
            description: "Retrieve a list of all current projects.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_member_tasks",
            description: "Get all tasks assigned to a specific member",
            parameters: {
                type: "object",
                properties: {
                    memberName: { type: "string" }
                },
                required: ["memberName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sprint_tasks",
            description: "Get all tasks assigned to a specific sprint",
            parameters: {
                type: "object",
                properties: {
                    sprintName: { type: "string" }
                },
                required: ["sprintName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_project_tasks",
            description: "Get all tasks belonging to a specific project",
            parameters: {
                type: "object",
                properties: {
                    projectName: { type: "string" }
                },
                required: ["projectName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_backlog_tasks",
            description: "Get all tasks currently in the backlog (not assigned to a sprint)",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_member_workload",
            description: "Get a summary of a member's current workload versus their capacity",
            parameters: {
                type: "object",
                properties: {
                    memberName: { type: "string" }
                },
                required: ["memberName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_workspace_summary",
            description: "Get a high-level summary of the entire workspace today (active sprints, total tasks, overloaded devs, etc.)",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "search_tasks",
            description: "Search for tasks matching a specific text query or keyword",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_eligible_candidates",
            description: "Find developers who have the specific required skill and evaluate their current workload.",
            parameters: {
                type: "object",
                properties: {
                    requiredSkill: { type: "string", description: "The skill category required by this task (e.g. 'API', 'Frontend', 'Database', 'Zoho')" }
                },
                required: ["requiredSkill"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_teams",
            description: "Retrieve a list of all existing engineering teams.",
            parameters: { type: "object", properties: {} }
        }
    },
    // --- PLAN TOOLS ---
    {
        type: "function",
        function: {
            name: "plan_create_project",
            description: "Propose creating a new project. Use this when the user wants to start a new project.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" }
                },
                required: ["name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_create_sprint",
            description: "Propose creating a new sprint. Use this for sprint planning.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    startDate: { type: "string", description: "YYYY-MM-DD" },
                    endDate: { type: "string", description: "YYYY-MM-DD" },
                    capacity: { type: "number" }
                },
                required: ["name", "startDate", "endDate", "capacity"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_update_member",
            description: "Propose updating a team member's profile attributes like skills, role, or capacity.",
            parameters: {
                type: "object",
                properties: {
                    memberId: { type: "string", description: "The UUID of the member profile retrieved from get_member_data. REQUIRED." },
                    memberName: { type: "string" },
                    name: { type: "string", description: "Update their full name" },
                    role: { type: "string", description: "Update their role" },
                    skills: { type: "string", description: "Update their skills (comma-separated string). If adding a skill, include the new skill along with existing ones." },
                    capacity: { type: "number", description: "Update their story point capacity" },
                    teamId: { type: "string", description: "The UUID of the team to assign this member to. MUST be an existing team UUID." }
                },
                required: ["memberId", "memberName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_assign_task",
            description: "Propose assigning a task to a member. This action is ADDITIVE. To replace an existing assignee, you MUST call plan_unassign_task first for the previous person.",
            parameters: {
                type: "object",
                properties: {
                    taskId: { type: "string" },
                    taskTitle: { type: "string" },
                    requiredSkill: { type: "string" },
                    recommendedAssigneeId: { type: "string" },
                    recommendedAssigneeName: { type: "string" },
                    reasoning: { type: "string" },
                    alternatives: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                assigneeId: { type: "string" },
                                assigneeName: { type: "string" },
                                skillScore: { type: "number" },
                                workload: { type: "string" }
                            }
                        }
                    }
                },
                required: ["taskId", "taskTitle", "requiredSkill", "recommendedAssigneeId", "recommendedAssigneeName", "reasoning", "alternatives"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_unassign_task",
            description: "Propose removing a member from a task. Use this when the user asks to 'remove', 'unassign', or 'replace' an assignee.",
            parameters: {
                type: "object",
                properties: {
                    taskId: { type: "string", description: "The UUID of the task" },
                    taskTitle: { type: "string" },
                    memberId: { type: "string", description: "The UUID of the member to UNLINK from the task." },
                    memberName: { type: "string" }
                },
                required: ["taskId", "taskTitle", "memberId", "memberName"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_create_task",
            description: "Propose creating a new task. Ask for missing details like title, points, or project if not provided.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    storyPoints: { type: "number" },
                    priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    projectId: { type: "string" },
                    sprintId: { type: "string" },
                    teamId: { type: "string" },
                    assigneeId: { type: "string", description: "The UUID of the member to assign this task to." },
                    assigneeName: { type: "string" }
                },
                required: ["title"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_create_team_member",
            description: "Propose adding a new team member profile.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                    skills: { type: "string", description: "Comma-separated string of skills" },
                    capacity: { type: "number" },
                    teamId: { type: "string" }
                },
                required: ["name", "email", "role"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_create_team",
            description: "Propose creating a new engineering team.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" }
                },
                required: ["name"]
            }
        }
    }
];

const BASE_SYSTEM_PROMPT = `
You are James, the SprintMind AI Operations Copilot.
Your goal is to help users manage their projects, sprints, and teams with intelligence.

Intelligent Recommendation Rules:
1. When asked what tasks to assign to member X, first analyze X's "role" and "skills" from the members list.
2. Check the "currentSprintTasks" in the snapshot. A task is UNASSIGNED only if its "assignees" list is EMPTY.
3. Match X's skills against task "skillCategory", "title", and "description".
4. ROLE SYNERGIES:
   - "API" tasks: Recommend "AI Agent Developer" or "Backend Developer".
   - "Backend" tasks: Recommend "AI Agent Developer" or "Backend Developer".
   - "Frontend" tasks: Recommend "Frontend Developer" or "UI/UX Designer".
5. REASSIGNMENT/REMOVAL:
   - When a user says "Remove X from task", "unassign X", or "Reassign task from X to Y", you MUST use "plan_unassign_task".
   - Assignments are ADDITIVE. To replace someone, you must UNLINK them first.

Precision Rules:
1. BE CONCISE. Do not list all tasks if the user asks for a recommendation.
2. ALWAYS provide accurate counts. If you list 5 tasks, do not say "there are 3".
3. USE READ TOOLS ONLY when the information is NOT in the Workspace Snapshot.
4. USE PLAN TOOLS to propose changes.

CRITICAL SAFETY RULES FOR IDs:
- ALWAYS use the core UUID string (e.g., "550e8400-e29b...") for any ID fields (projectId, sprintId, memberId, teamId).
- NEVER use the "name" of the project or sprint as an ID.
- Check the Workspace Snapshot for the correct UUID before proposing a plan.
`;

function buildWorkspaceSnapshot(context: { profiles: any[], teams: any[], projects: any[], sprints: any[], tasks: any[], developerSkillProfiles?: any[] }) {
    const activeSprints = context.sprints.filter(s => s.status !== "completed");
    const activeSprintIds = activeSprints.map(s => s.id);

    const membersSummary = context.profiles.map(p => {
        const assignedTasks = context.tasks.filter(t => t.assignees?.some((a: any) => a.id === p.id));
        const assignedPoints = assignedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const capacity = p.capacity || 40;

        return {
            id: p.id,
            name: p.name,
            role: p.role,
            capacity,
            assignedPoints,
            isOverloaded: assignedPoints > capacity,
            skills: (p.skills || "").split(",").map((s: string) => s.trim()).filter(Boolean)
        };
    });

    const sprintTasks = context.tasks.filter(t =>
        t.sprint?.id && activeSprintIds.includes(t.sprint.id)
    ).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        skillCategory: t.skillCategory,
        priority: t.priority,
        points: t.storyPoints || 0,
        assignees: (t.assignees || []).map((a: any) => a.name)
    }));

    const snapshot = {
        activeSprints: activeSprints.map(s => ({ id: s.id, name: s.name })),
        activeTeams: context.teams.map(t => ({ id: t.id, name: t.name })),
        members: membersSummary,
        overloadedMembers: membersSummary.filter(m => m.isOverloaded).map(m => m.name),
        currentSprintTasks: sprintTasks,
        projects: context.projects.map(p => ({ id: p.id, name: p.name }))
    };

    return `\n\n--- WORKSPACE SNAPSHOT ---\n${JSON.stringify(snapshot, null, 2)}\n\nOnly call tools if the snapshot above lacks specific data needed.`;
}

export async function runAssistantAgent(
    message: string,
    history: any[] = [],
    context: { profiles: any[], teams: any[], projects: any[], sprints: any[], tasks: any[], developerSkillProfiles?: any[] }
): Promise<AssistantResponse> {

    const systemPromptWithSnapshot = BASE_SYSTEM_PROMPT + buildWorkspaceSnapshot(context);

    const messages: any[] = [
        { role: "system", content: systemPromptWithSnapshot },
        ...history,
        { role: "user", content: message }
    ];

    const logs: string[] = [];
    const displayData: any[] = [];
    let toolResultResponse: AssistantResponse | null = null;
    let stepCount = 1;

    // Agent Loop: Max 4 iterations
    for (let i = 0; i < 4; i++) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: TOOLS,
            tool_choice: "auto",
        });

        const msg = response.choices[0].message;
        messages.push(msg);

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            return {
                intent: "conversation",
                data: {},
                explanation: msg.content || "I'm not sure how to respond to that.",
                confidence: 1.0,
                tool_logs: logs,
                displayData: displayData.length > 0 ? displayData : undefined
            };
        }

        // Process tool calls
        for (const toolCall of msg.tool_calls) {
            const funcCall = (toolCall as any).function;
            if (!funcCall) continue;
            const name = funcCall.name;
            const args = JSON.parse(funcCall.arguments);
            logs.push(`Step ${stepCount}: Called ${name}(${JSON.stringify(args).slice(0, 100)}${JSON.stringify(args).length > 100 ? '...' : ''})`);
            stepCount++;

            let result: any = null;

            if (name === "get_member_data") {
                const results = context.profiles.filter(p =>
                    p.name.toLowerCase().includes(args.name?.toLowerCase() || "")
                );
                result = results.map(p => ({ id: p.id, name: p.name, capacity: p.capacity, team: p.team?.name }));
            } else if (name === "get_active_sprints") {
                result = context.sprints.filter(s => s.status !== "completed");
            } else if (name === "get_projects") {
                result = context.projects.map(p => ({ id: p.id, name: p.name }));
            } else if (name === "get_member_tasks") {
                const member = context.profiles.find(p => p.name.toLowerCase().includes(args.memberName.toLowerCase()));
                if (member) {
                    const tasks = context.tasks.filter(t => t.assignees?.some((a: any) => a.id === member.id));
                    result = tasks.map(t => ({ id: t.id, title: t.title, status: t.status, points: t.storyPoints, sprintName: t.sprint?.name }));
                    displayData.push({ type: "task_list", data: result, title: `Tasks for ${member.name}` });
                } else {
                    result = { error: "Member not found" };
                }
            } else if (name === "get_sprint_tasks") {
                const sprint = context.sprints.find(s => s.name.toLowerCase().includes(args.sprintName.toLowerCase()));
                if (sprint) {
                    const tasks = context.tasks.filter(t => t.sprint?.id === sprint.id);
                    result = tasks.map(t => ({ id: t.id, title: t.title, status: t.status, points: t.storyPoints, skillCategory: t.skillCategory, assigneeName: t.assignees?.[0]?.name }));
                } else {
                    result = { error: "Sprint not found" };
                }
            } else if (name === "get_project_tasks") {
                const project = context.projects.find(p => p.name.toLowerCase().includes(args.projectName.toLowerCase()));
                if (project) {
                    const tasks = context.tasks.filter(t => t.project?.id === project.id);
                    result = tasks.map(t => ({ id: t.id, title: t.title, status: t.status, points: t.storyPoints, skillCategory: t.skillCategory }));
                } else {
                    result = { error: "Project not found" };
                }
            } else if (name === "get_backlog_tasks") {
                const tasks = context.tasks.filter(t => !t.sprint?.id);
                result = tasks.map(t => ({ id: t.id, title: t.title, status: t.status, points: t.storyPoints, skillCategory: t.skillCategory }));
            } else if (name === "get_member_workload") {
                const member = context.profiles.find(p => p.name.toLowerCase().includes(args.memberName.toLowerCase()));
                if (member) {
                    const assignedTasks = context.tasks.filter(t => t.assignees?.some((a: any) => a.id === member.id));
                    const assignedPoints = assignedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
                    result = {
                        member: member.name,
                        capacity: member.capacity || 40,
                        assignedPoints,
                        tasksCount: assignedTasks.length,
                        isOverloaded: assignedPoints > (member.capacity || 40),
                        role: member.role,
                        skills: member.skills
                    };
                    displayData.push({ type: "workload", data: result });
                } else {
                    result = { error: "Member not found" };
                }
            } else if (name === "get_workspace_summary") {
                const activeSprints = context.sprints.filter(s => s.status !== "completed");
                const tasksInProgress = context.tasks.filter(t => ["ready", "in_progress", "doing"].includes(t.status)).length;
                const backlogTasks = context.tasks.filter(t => !t.sprint?.id).length;

                let overloadedDevs = 0;
                context.profiles.forEach(p => {
                    const pts = context.tasks.filter(t => t.assignees?.some((a: any) => a.id === p.id)).reduce((sum, t) => sum + (t.storyPoints || 0), 0);
                    if (pts > (p.capacity || 40)) overloadedDevs++;
                });

                result = {
                    activeSprints: activeSprints.map(s => s.name),
                    tasksInProgress,
                    backlogTasks,
                    overloadedDevelopers: overloadedDevs
                };
            } else if (name === "search_tasks") {
                const query = args.query.toLowerCase();
                const matched = context.tasks.filter(t => (t.title && t.title.toLowerCase().includes(query)) || (t.description && t.description.toLowerCase().includes(query)));
                result = matched.map(t => ({ id: t.id, title: t.title, status: t.status, points: t.storyPoints, skillCategory: t.skillCategory }));
            } else if (name === "get_eligible_candidates") {
                const requiredSkill = args.requiredSkill.toLowerCase();
                const ACTIVE_STATUSES = ["ready", "in_progress", "doing", "review", "testing"];

                // Define role-to-skill mappings for wider matching
                const roleSynergies: Record<string, string[]> = {
                    "ai": ["api", "backend", "python", "data"],
                    "backend": ["api", "database", "zoho", "server"],
                    "frontend": ["ui", "ux", "web", "react", "styling"],
                    "fullstack": ["api", "frontend", "backend", "database"],
                    "ai agent developer": ["ai", "api", "backend", "automation"],
                    "ui/ux designer": ["frontend", "styling", "design", "figma"]
                };

                const candidates = context.profiles.filter(p => {
                    const skills = (p.skills || "").toLowerCase();
                    const role = (p.role || "").toLowerCase();

                    // Direct skill match
                    if (skills.includes(requiredSkill)) return true;

                    // Role match
                    if (role.includes(requiredSkill)) return true;

                    // Synergy match
                    const synergisticSkills = roleSynergies[role] || [];
                    if (synergisticSkills.includes(requiredSkill)) return true;

                    return false;
                }).map(p => {
                    const activeTasks = context.tasks.filter((t: any) => t.assignees?.some((a: any) => a.id === p.id) && ACTIVE_STATUSES.includes(t.status));
                    const assignedPoints = activeTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);
                    return {
                        id: p.id,
                        name: p.name,
                        role: p.role,
                        skills: p.skills,
                        capacity: p.capacity || 40,
                        assignedPoints,
                        activeTaskCount: activeTasks.length,
                        isOverloaded: assignedPoints > (p.capacity || 40)
                    };
                });
                result = candidates;
            } else if (name === "get_teams") {
                result = context.teams.map(t => ({ id: t.id, name: t.name }));
            } else if (name.startsWith("plan_")) {
                console.log("[AI Assistant DEBUG] Generated Plan Args for", name, ":", args);
                // If it's a plan tool, we return the result to the UI after all tool calls in this turn
                toolResultResponse = {
                    intent: name,
                    data: args,
                    explanation: "", // Will be filled by AI content in next step or final step
                    confidence: 0.95,
                    tool_logs: logs
                };
                result = { status: "planned", data: args };
            }

            logs.push(`Step ${stepCount}: Received data for ${name}`);
            stepCount++;

            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
            });
        }

        // Check if we have a proposal ready to stop the loop
        if (toolResultResponse) {
            // Get one last completion to generate the explanation text
            const final = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
            });
            toolResultResponse.explanation = final.choices[0].message.content || `I've planned the ${toolResultResponse.intent.replace("plan_", "")}.`;
            toolResultResponse.displayData = displayData;
            return toolResultResponse;
        }
    }

    return {
        intent: "conversation", // Default back to conversation instead of unknown if no plan was made but it successfully answered the question using tools
        data: {},
        explanation: messages[messages.length - 1].content || "I've pulled that information for you.",
        confidence: 1.0,
        tool_logs: logs,
        displayData
    };
}

// Keep legacy export for basic backward compatibility (optional, but good for transition)
export async function parseAssistantIntent(message: string, history: any[] = []): Promise<any> {
    return runAssistantAgent(message, history, { profiles: [], teams: [], projects: [], sprints: [], tasks: [], developerSkillProfiles: [] });
}
