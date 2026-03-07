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
}

interface ExtractedStory {
    title: string;
    description: string;
    tasks: ExtractedTask[];
    priority: "critical" | "high" | "medium" | "low";
}

interface ExtractedEpic {
    title: string;
    description: string;
    stories: ExtractedStory[];
}

export interface MeetingAnalysisResult {
    project?: string | null;
    summary: string;
    epics: ExtractedEpic[];
    decisions: string[];
    blockers: string[];
    action_items: string[];
}

export async function analyzeMeeting(
    transcript: string,
    contextData?: { profiles: any[]; teams: any[]; projects: any[] }
): Promise<{ success: boolean; data?: MeetingAnalysisResult; error?: string }> {
    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "__PLACEHOLDER__") {
            return { success: false, error: "OpenAI API key not configured. Please add your key to .env.local" };
        }

        let contextString = "";
        if (contextData) {
            contextString = `
AVAILABLE DEVELOPER PROFILES (Use these to assign tasks):
${JSON.stringify((contextData.profiles || []).map(p => ({ id: p.id, name: p.name, role: p.role, skills: p.skills, team: p.team?.name || null })), null, 2)}

AVAILABLE TEAMS:
${JSON.stringify((contextData.teams || []).map(t => ({ id: t.id, name: t.name })), null, 2)}

AVAILABLE PROJECTS:
${JSON.stringify((contextData.projects || []).map(p => ({ id: p.id, name: p.name, description: p.description })), null, 2)}

INSTRUCTIONS FOR PER-TASK ASSIGNMENT:
For EACH task, you must determine:
1. Which PROJECT this task belongs to — match from AVAILABLE PROJECTS by name/context. Set "suggested_project_id" and "suggested_project_name". Different tasks in the same meeting can belong to different projects.
2. Which TEAM should work on this task — match from AVAILABLE TEAMS. Set "suggested_team_id" and "suggested_team_name". Infer from the developer mentioned or the nature of the task (e.g. backend tasks → Backend Team).
3. Which DEVELOPER should be assigned — match from AVAILABLE DEVELOPER PROFILES by name mentioned in transcript, or by matching skills/role. Set "suggested_assignee_id" and "suggested_assignee_name".

If a developer name is mentioned in the transcript (e.g. "Dinakar will handle backend"), find the matching profile and set both id and name.
If a team name is mentioned (e.g. "backend team"), find the matching team.
If a project is discussed, match it to the closest AVAILABLE PROJECT.
If no match is found, set the id to null but still provide the name/description.
`;
        }

        const SYSTEM_PROMPT = `You are a software project analyst. You analyze meeting transcripts and extract structured sprint planning data.

Given a meeting transcript, extract:
1. The overall project context (for the "project" field - what the meeting is generally about)
2. A brief summary (2-3 sentences)
3. Epics (major feature areas)
4. Stories within each epic (user-facing features)
5. Tasks within each story (actionable dev tasks)
6. Key decisions made
7. Blockers identified
8. Action items

For each task, determine priority: critical, high, medium, or low.
For each task, estimate story_points using Fibonacci scale (1, 2, 3, 5, 8, 13) based on complexity.
For each task, determine which project, team, and developer it should be assigned to.
${contextString}

Return ONLY valid JSON matching this schema:
{
  "project": "string or null (overall meeting topic)",
  "summary": "string",
  "epics": [
    {
      "title": "string",
      "description": "string", 
      "stories": [
        {
          "title": "string",
          "description": "string",
          "tasks": [
            {
              "title": "string",
              "description": "string",
              "priority": "high|medium|low|critical",
              "story_points": "number (1,2,3,5,8,13)",
              "suggested_assignee_id": "string or null",
              "suggested_assignee_name": "string or null",
              "suggested_project_id": "string or null",
              "suggested_project_name": "string or null",
              "suggested_team_id": "string or null",
              "suggested_team_name": "string or null"
            }
          ],
          "priority": "high|medium|low|critical"
        }
      ]
    }
  ],
  "decisions": ["string"],
  "blockers": ["string"],
  "action_items": ["string"]
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
