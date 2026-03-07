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
        epics: i.entity({
            title: i.string(),
            description: i.string().optional(),
            color: i.string().optional(),
            createdAt: i.date(),
        }),
        stories: i.entity({
            title: i.string(),
            description: i.string().optional(),
            priority: i.string(), // "critical" | "high" | "medium" | "low"
            storyPoints: i.number().optional(),
            status: i.string(), // "backlog" | "ready" | "in_progress" | "review" | "testing" | "done"
            createdAt: i.date(),
        }),
        tasks: i.entity({
            title: i.string(),
            description: i.string().optional(),
            status: i.string(), // "backlog" | "ready" | "in_progress" | "review" | "testing" | "done"
            priority: i.string(), // "critical" | "high" | "medium" | "low"
            assignee: i.string().optional(),
            labels: i.string().optional(), // comma-separated
            deadline: i.string().optional(),
            storyPoints: i.number().optional(),
            columnOrder: i.number().optional(),
            // Direct ID fields for relationships (bypasses InstantDB link constraints)
            projectId: i.string().optional(),
            teamId: i.string().optional(),
            assigneeId: i.string().optional(),
            sprintId: i.string().optional(),
            meetingId: i.string().optional(),
            storyId: i.string().optional(),
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
        teams: i.entity({
            name: i.string(),
            createdAt: i.date(),
        }),
        profiles: i.entity({
            name: i.string(),
            email: i.string(),
            phone: i.string().optional(),
            role: i.string(),
            skills: i.string().optional(),
            avatarUrl: i.string().optional(),
            status: i.string(), // "Available" | "Busy" | "Offline"
            capacity: i.number(), // Story points per sprint
            createdAt: i.date(),
        }),
    },
    links: {
        projectEpics: {
            forward: { on: "projects", has: "many", label: "epics" },
            reverse: { on: "epics", has: "one", label: "project" },
        },
        sprintStories: {
            forward: { on: "sprints", has: "many", label: "stories" },
            reverse: { on: "stories", has: "one", label: "sprint" },
        },
        epicStories: {
            forward: { on: "epics", has: "many", label: "stories" },
            reverse: { on: "stories", has: "one", label: "epic" },
        },
        storyTasks: {
            forward: { on: "stories", has: "many", label: "storyTasks" },
            reverse: { on: "tasks", has: "one", label: "story" },
        },
        taskSubtasks: {
            forward: { on: "tasks", has: "many", label: "subtasks" },
            reverse: { on: "subtasks", has: "one", label: "task" },
        },
        meetingProject: {
            forward: { on: "meetings", has: "one", label: "project" },
            reverse: { on: "projects", has: "many", label: "meetings" },
        },
        meetingStories: {
            forward: { on: "meetings", has: "many", label: "stories" },
            reverse: { on: "stories", has: "one", label: "meeting" },
        },
        projectTasks: {
            forward: { on: "projects", has: "many", label: "tasks" },
            reverse: { on: "tasks", has: "one", label: "project" },
        },
        teamMembers: {
            forward: { on: "teams", has: "many", label: "members" },
            reverse: { on: "profiles", has: "one", label: "team" },
        },
        profileTasks: {
            forward: { on: "profiles", has: "many", label: "assignedTasks" },
            reverse: { on: "tasks", has: "one", label: "assigneeProfile" },
        },
        teamTasks: {
            forward: { on: "teams", has: "many", label: "assignedTasks" },
            reverse: { on: "tasks", has: "one", label: "assigneeTeam" },
        },
        taskActivityLogs: {
            forward: { on: "tasks", has: "many", label: "activityLogs" },
            reverse: { on: "activityLogs", has: "one", label: "task" },
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
        attachmentAuthor: {
            forward: { on: "attachments", has: "one", label: "uploadedBy" },
            reverse: { on: "profiles", has: "many", label: "attachments" },
        },
        sprintTasks: {
            forward: { on: "sprints", has: "many", label: "sprintTasks" },
            reverse: { on: "tasks", has: "one", label: "sprint" },
        },
        meetingTasks: {
            forward: { on: "meetings", has: "many", label: "generatedTasks" },
            reverse: { on: "tasks", has: "one", label: "sourceMeeting" },
        },
    },
    rooms: {},
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
