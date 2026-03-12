import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "__PLACEHOLDER__") {
            return NextResponse.json({ success: false, error: "OpenAI API key not configured." }, { status: 400 });
        }

        const body = await req.json();
        const { backlogTasks, profiles, activeSprintCapacity } = body;

        const tasksWithShortIds = backlogTasks.map((t: any, index: number) => ({
            _realId: t.id,
            id: `task_${index}`,
            title: t.title,
            priority: t.priority,
            storyPoints: t.storyPoints || 3,
            description: t.description?.substring(0, 100)
        }));

        const profilesWithShortIds = profiles.map((p: any, index: number) => ({
            _realId: p.id,
            id: `dev_${index}`,
            name: p.name,
            role: p.role,
            skills: p.skills,
            capacity: p.capacity
        }));

        const SYSTEM_PROMPT = `You are an expert Agile Scrum Master and Sprint Planner.
Your job is to assign tasks from the backlog to developers for the upcoming sprint.
You must maximize the sprint value while ensuring no developer exceeds their capacity limit.
You should also try to match tasks to developers based on their roles/skills if possible (e.g. backend tasks to backend devs).

Rules:
1. Do not exceed any developer's capacity (Story Points).
2. If a task has no story points, assume it is 3 points.
3. Prioritize "critical" and "high" tasks first.
4. Total assigned points across all developers should not significantly exceed the overall team activeSprintCapacity if provided.

Given:
DEVELOPER PROFILES:
${JSON.stringify(profilesWithShortIds.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            skills: p.skills,
            capacity: p.capacity
        })), null, 2)}

BACKLOG TASKS:
${JSON.stringify(tasksWithShortIds.map((t: any) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            storyPoints: t.storyPoints,
            description: t.description
        })), null, 2)}

TEAM SPRINT CAPACITY: ${activeSprintCapacity || "Unknown"}

Return ONLY a valid JSON object matching this schema:
{
  "assignments": [
    {
      "taskId": "string (the short id like task_0)",
      "taskTitle": "string",
      "assigneeId": "string (the short dev id like dev_0)",
      "reasoning": "A short 1-sentence explanation of why this task was assigned to this developer"
    }
  ],
  "unassignedTaskIds": ["string"],
  "summary": "A 2-sentence summary of the sprint plan strategy."
}`;

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: "Please generate the optimal sprint plan." }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return NextResponse.json({ success: false, error: "No response from AI model" }, { status: 500 });
        }

        const parsed = JSON.parse(content);

        // Map short IDs back to real UUIDs
        const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (parsed.assignments) {
            parsed.assignments = parsed.assignments.map((a: any) => {
                const taskMatch = tasksWithShortIds.find((t: any) => t.id === a.taskId);
                const devMatch = profilesWithShortIds.find((p: any) => p.id === a.assigneeId);

                const finalTaskId = taskMatch ? taskMatch._realId : a.taskId;
                const finalAssigneeId = devMatch ? devMatch._realId : a.assigneeId;

                return {
                    ...a,
                    taskId: isUuid(finalTaskId) ? finalTaskId : null,
                    assigneeId: isUuid(finalAssigneeId) ? finalAssigneeId : null
                };
            }).filter((a: any) => a.taskId !== null); // Filter out tasks with invalid IDs
        }
        if (parsed.unassignedTaskIds) {
            parsed.unassignedTaskIds = parsed.unassignedTaskIds.map((tid: any) => {
                const match = tasksWithShortIds.find((t: any) => t.id === tid);
                const finalId = match ? match._realId : tid;
                return isUuid(finalId) ? finalId : null;
            }).filter((id: any) => id !== null);
        }

        return NextResponse.json({ success: true, data: parsed });

    } catch (error: any) {
        console.error("Sprint Planning API error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to generate sprint plan" }, { status: 500 });
    }
}
