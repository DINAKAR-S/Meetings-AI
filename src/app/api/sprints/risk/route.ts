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
        const { sprintName, tasks, profiles } = body;

        if (!tasks || !profiles) {
            return NextResponse.json({ success: false, error: "Missing required data" }, { status: 400 });
        }

        const SYSTEM_PROMPT = `You are an expert Agile Delivery Manager and AI Risk Detector.
Your job is to analyze the current sprint workload, task statuses, and developer capacities to identify any execution risks.

Given:
SPRINT NAME: ${sprintName}

DEVELOPER PROFILES:
${JSON.stringify(profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            capacity: p.capacity
        })), null, 2)}

SPRINT TASKS:
${JSON.stringify(tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            storyPoints: t.storyPoints || 3,
            assigneeId: t.assigneeId
        })), null, 2)}

Analyze the data for:
1. Overloaded developers (assigned points > capacity).
2. Blockers or tight bottlenecks (too many things in 'in_progress' or 'review' for a single person).
3. Critical tasks that are untouched ('backlog' or 'ready').

Return ONLY a valid JSON object matching this schema:
{
  "healthScore": "string", // Must be one of: "On Track", "Medium Risk", "High Risk"
  "riskSummary": "A concise 2-sentence summary of the main risks identified (or why it's on track)",
  "mitigations": [
    "Actionable suggestion 1 (e.g., Move task X from person A to person B)",
    "Actionable suggestion 2"
  ]
}`;

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: "Analyze the sprint health and identify risks." }
            ],
            response_format: { type: "json_object" },
            max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return NextResponse.json({ success: false, error: "No response from AI model" }, { status: 500 });
        }

        const parsed = JSON.parse(content);
        return NextResponse.json({ success: true, data: parsed });

    } catch (error: any) {
        console.error("Sprint Risk API error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to analyze sprint risk" }, { status: 500 });
    }
}
