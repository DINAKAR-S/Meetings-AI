"use server";

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

interface ExtractedTask {
    title: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    story_points?: number;
    suggested_assignee_id?: string | null;
    suggested_assignee_name?: string | null;
    suggested_project_id?: string | null;
    suggested_project_name?: string | null;
    suggested_team_id?: string | null;
    suggested_team_name?: string | null;
    skill_category?: string;
}

export interface MeetingAnalysisResult {
    project?: string | null;
    summary: string;
    tasks: ExtractedTask[];
    decisions: string[];
    blockers: string[];
    action_items: string[];
    auto_plan?: {
        sprint_name: string;
        sprint_id: string | null;
        total_points: number;
        capacity_limit: number;
        overloaded: boolean;
        developer_breakdown: {
            name: string;
            profile_id: string | null;
            tasks: string[];
            points: number;
            capacity: number;
        }[];
    } | null;
}

export async function analyzeMeeting(
    transcript: string,
    contextData?: {
        profiles: any[];
        teams: any[];
        projects: any[];
        activeSprint?: any;
    }
): Promise<{ success: boolean; data?: MeetingAnalysisResult; error?: string }> {
    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "__PLACEHOLDER__") {
            return { success: false, error: "OpenAI API key not configured. Please add your key to .env.local" };
        }

        let contextString = "";
        if (contextData) {
            contextString = `
AVAILABLE DEVELOPER PROFILES (Use these to assign tasks):
${JSON.stringify((contextData.profiles || []).map(p => ({ id: p.id, name: p.name, role: p.role, skills: p.skills, team: p.team?.name || null, capacity: p.capacity })), null, 2)}

AVAILABLE TEAMS:
${JSON.stringify((contextData.teams || []).map(t => ({ id: t.id, name: t.name })), null, 2)}

AVAILABLE PROJECTS:
${JSON.stringify((contextData.projects || []).map(p => ({ id: p.id, name: p.name, description: p.description })), null, 2)}

ACTIVE SPRINT:
${contextData.activeSprint ? JSON.stringify({ id: contextData.activeSprint.id, name: contextData.activeSprint.name, capacity: contextData.activeSprint.capacity }, null, 2) : "None active"}

INSTRUCTIONS FOR PER-TASK ASSIGNMENT:
For EACH task, you must determine:
1. Which PROJECT this task belongs to — match from AVAILABLE PROJECTS by name/context. Set "suggested_project_id" and "suggested_project_name".
2. Which TEAM should work on this task — match from AVAILABLE TEAMS. Set "suggested_team_id" and "suggested_team_name".
3. Which DEVELOPER should be assigned — match from AVAILABLE DEVELOPER PROFILES by name or skills. Set "suggested_assignee_id" and "suggested_assignee_name".
4. Which SKILL CATEGORY this task requires (e.g. "API", "Frontend", "Database", "Design", "DevOps"). Set "skill_category".

INSTRUCTIONS FOR AUTO-SPRINT PLAN:
Based on the extracted tasks and the ACTIVE SPRINT:
1. Group these tasks by the assigned DEVELOPER.
2. Calculate the total points for each developer.
3. Compare against the developer's per-sprint CAPACITY.
4. If there is an ACTIVE SPRINT, provide a consolidated "auto_plan" summary.
5. If the total points exceed the active sprint capacity (or individual dev capacities), mark "overloaded" as true.
`;
        }

        const SYSTEM_PROMPT = `You are a software project analyst. You analyze meeting transcripts and extract structured sprint planning data.

110: Given a meeting transcript, extract:
111: 1. The overall project context
112: 2. A brief summary
113: 3. Tasks extracted from the discussion
114: 4. Key decisions, Blockers, and Action items
6. An AI-calculated Auto Sprint Plan (if sprint context is provided)

For each task, estimate story_points using Fibonacci scale (1, 2, 3, 5, 8, 13).
${contextString}

Return ONLY valid JSON matching this schema:
{
  "project": "string or null",
  "summary": "string",
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "high|medium|low|critical",
      "story_points": number,
      "suggested_assignee_id": "string or null",
      "suggested_assignee_name": "string or null",
      "suggested_project_id": "string or null",
      "suggested_project_name": "string or null",
      "suggested_team_id": "string or null",
      "suggested_team_name": "string or null",
      "skill_category": "string (e.g., API, Database, Frontend, etc.)"
    }
  ],
  "decisions": ["string"],
  "blockers": ["string"],
  "action_items": ["string"],
  "auto_plan": {
    "sprint_name": "string",
    "sprint_id": "string or null",
    "total_points": number,
    "capacity_limit": number,
    "overloaded": boolean,
    "developer_breakdown": [
      {
        "name": "string",
        "profile_id": "string or null",
        "tasks": ["string (titles)"],
        "points": number,
        "capacity": number
      }
    ]
  }
}`;

        const chunks = chunkText(transcript);
        let fullTranscript = transcript;

        if (chunks.length > 1) {
            const summaries = [];
            for (const chunk of chunks) {
                const res = await openai.chat.completions.create({
                    model,
                    messages: [
                        { role: "system", content: "Summarize the key points, decisions, task assignments, and action items from this meeting transcript segment. Preserve all names mentioned." },
                        { role: "user", content: chunk }
                    ],
                    max_tokens: 1000,
                });
                summaries.push(res.choices[0]?.message?.content || "");
            }
            fullTranscript = summaries.join("\n\n---\n\n");
        }

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Analyze this meeting transcript:\n\n${fullTranscript}` },
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, error: "No response from AI model" };
        }

        const parsed = JSON.parse(content) as MeetingAnalysisResult;
        return { success: true, data: parsed };
    } catch (error: any) {
        console.error("Meeting analysis error:", error);
        return { success: false, error: error.message || "Failed to analyze meeting" };
    }
}

function chunkText(text: string, maxChunkLength = 12000): string[] {
    if (text.length <= maxChunkLength) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + maxChunkLength, text.length);
        if (end < text.length) {
            const newlineIdx = text.lastIndexOf("\n", end);
            if (newlineIdx > start + maxChunkLength * 0.5) end = newlineIdx + 1;
        }
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

export async function transcribeAudio(
    formData: FormData
): Promise<{ success: boolean; transcript?: string; error?: string }> {
    try {
        const file = formData.get("audio") as File;
        if (!file) return { success: false, error: "No audio file provided" };

        const response = await openai.audio.transcriptions.create({
            file,
            model: "whisper-1",
        });

        return { success: true, transcript: response.text };
    } catch (error: any) {
        console.error("Transcription error:", error);
        return { success: false, error: error.message || "Failed to transcribe audio" };
    }
}
