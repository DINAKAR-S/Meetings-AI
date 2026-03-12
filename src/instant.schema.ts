import { i } from "@instantdb/react";

const _schema = i.schema({
    entities: {
        $files: i.entity({
            path: i.string().unique().indexed(),
            url: i.string(),
        }),
        $users: i.entity({
            email: i.string().unique().indexed().optional(),
            imageURL: i.string().optional(),
            type: i.string().optional(),
        }),
        projects: i.entity({
            name: i.string(),
            description: i.string().optional(),
            color: i.string().optional(),
            status: i.string().optional(), // "active" | "archived" | "planned"
            createdAt: i.date(),
        }),
        teams: i.entity({
            name: i.string(),
            description: i.string().optional(),
            createdAt: i.date(),
        }),
        profiles: i.entity({
            name: i.string(),
            email: i.string(),
            phone: i.string().optional(),
            role: i.string(),
            avatarUrl: i.string().optional(),
            skills: i.string().optional(),
            status: i.string(), // "Available" | "Busy" | "Offline"
            capacity: i.number(), // Story points per sprint
            createdAt: i.date(),
        }),
        sprints: i.entity({
            name: i.string(),
            startDate: i.string(),
            endDate: i.string(),
            capacity: i.number().optional(),
            status: i.string(), // "planning" | "active" | "completed"
            createdAt: i.date(),
        }),

        tasks: i.entity({
            title: i.string(),
            description: i.string().optional(),
            status: i.string(), // "backlog" | "ready" | "in_progress" | "review" | "testing" | "done"
            priority: i.string(), // "critical" | "high" | "medium" | "low"
            storyPoints: i.number().optional(),
            skillCategory: i.string().optional(), // "API", "Frontend", "Database", etc.
            tags: i.json().optional(), // Array of tag strings
            source: i.string().optional(), // e.g. "Meeting", "AI", "Manual"
            completedAt: i.date().optional(),
            createdAt: i.date(),
        }),
        developerSkillProfiles: i.entity({
            skillName: i.string(), // e.g., "API", "React"
            score: i.number(), // Decimal out of 1.0 (e.g. 0.92)
            tasksCompleted: i.number(),
            avgCompletionTime: i.number().optional(), // In days
            createdAt: i.date(),
        }),
        subtasks: i.entity({
            title: i.string(),
            done: i.boolean(),
            createdAt: i.date(),
        }),
        comments: i.entity({
            message: i.string(),
            createdAt: i.date(),
        }),
        attachments: i.entity({
            fileUrl: i.string(),
            fileName: i.string(),
            createdAt: i.date(),
        }),
        meetings: i.entity({
            title: i.string(),
            rawTranscript: i.string().optional(),
            summary: i.string().optional(),
            inputType: i.string(), // "text" | "audio" | "notes"
            aiResult: i.string().optional(), // JSON string of extracted data
            acceptedStoryKeys: i.string().optional(), // JSON string of accepted story keys
            processedAt: i.date().optional(),
            createdAt: i.date(),
        }),
        activityLogs: i.entity({
            action: i.string(),
            entityType: i.string(),
            entityId: i.string().optional(),
            details: i.string().optional(),
            createdAt: i.date(),
        }),
        chatSessions: i.entity({
            title: i.string(),
            createdAt: i.date(),
            updatedAt: i.date(),
        }),
        chatMessages: i.entity({
            content: i.string(),
            role: i.string(), // "user" | "assistant"
            status: i.string().optional(), // "pending" | "executed" | "cancelled"
            proposal: i.json().optional(),
            tool_logs: i.json().optional(),
            displayData: i.json().optional(),
            createdAt: i.date(),
        }),
    },
    links: {
        profileTeam: {
            forward: { on: "profiles", has: "one", label: "team" },
            reverse: { on: "teams", has: "many", label: "members" },
        },
        taskAssignees: {
            forward: { on: "tasks", has: "many", label: "assignees" },
            reverse: { on: "profiles", has: "many", label: "assignedTasksArr" },
        },
        assignedTeam: {
            forward: { on: "tasks", has: "one", label: "assignedTeam" },
            reverse: { on: "teams", has: "many", label: "assignedTeamTasksArr" },
        },
        projectSprints: {
            forward: { on: "sprints", has: "one", label: "project" },
            reverse: { on: "projects", has: "many", label: "sprints" },
        },
        sprintTasks: {
            forward: { on: "tasks", has: "one", label: "sprint" },
            reverse: { on: "sprints", has: "many", label: "tasks" },
        },

        taskSubtasks: {
            forward: { on: "tasks", has: "many", label: "subtasks" },
            reverse: { on: "subtasks", has: "one", label: "task" },
        },
        projectTasks: {
            forward: { on: "projects", has: "many", label: "tasks" },
            reverse: { on: "tasks", has: "one", label: "project" },
        },
        meetingProject: {
            forward: { on: "meetings", has: "one", label: "project" },
            reverse: { on: "projects", has: "many", label: "meetings" },
        },
        meetingTasks: {
            forward: { on: "meetings", has: "many", label: "generatedTasks" },
            reverse: { on: "tasks", has: "one", label: "sourceMeeting" },
        },
        taskComments: {
            forward: { on: "tasks", has: "many", label: "comments" },
            reverse: { on: "comments", has: "one", label: "task" },
        },
        commentAuthor: {
            forward: { on: "comments", has: "one", label: "author" },
            reverse: { on: "profiles", has: "many", label: "comments" },
        },
        taskAttachments: {
            forward: { on: "tasks", has: "many", label: "attachments" },
            reverse: { on: "attachments", has: "one", label: "task" },
        },
        profileSkills: {
            forward: { on: "profiles", has: "many", label: "skillProfiles" },
            reverse: { on: "developerSkillProfiles", has: "one", label: "profile" },
        },

        taskActivityLogs: {
            forward: { on: "tasks", has: "many", label: "activityLogs" },
            reverse: { on: "activityLogs", has: "one", label: "task" },
        },
        chatSessionMessages: {
            forward: { on: "chatSessions", has: "many", label: "messages" },
            reverse: { on: "chatMessages", has: "one", label: "session" },
        },
    },
    rooms: {},
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
