import { query } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCheckpointMcpServer, CHECKPOINT_SERVER_NAME } from "./checkpointTool.js";
import { createCheckpointHook, CHECKPOINT_HOOK_MATCHER } from "./checkpointHook.js";
import { SYSTEM_PROMPT_ADDENDUM } from "./systemPromptAddendum.js";

// Nur die in CLAUDE.md dokumentierten Befehle -- alles andere wird
// automatisch abgelehnt, ohne dass jemand da sein muss um zu entscheiden.
// Das ist die PRIMAERE Entscheidungsstelle, kein Fallback-Netz.
const ALLOWED_BASH_PREFIXES = [
  /^ffmpeg\b/,
  /^ffprobe\b/,
  /^uv run --project \.\/video-use\b.*--system-certs/,
  /^curl\b.*api\.elevenlabs\.io/,
];

const allowlistCanUseTool: CanUseTool = async (toolName, input) => {
  if (toolName === "Bash") {
    const cmd = String((input as { command?: string }).command ?? "").trim();
    if (!ALLOWED_BASH_PREFIXES.some((re) => re.test(cmd))) {
      return { behavior: "deny", message: `Befehl nicht in der Allowlist: ${cmd}` };
    }
    return { behavior: "allow", updatedInput: input };
  }

  if (["Read", "Write", "Edit", "Glob", "Grep"].includes(toolName)) {
    return { behavior: "allow", updatedInput: input };
  }

  return {
    behavior: "deny",
    message: `Tool nicht erlaubt im unbeaufsichtigten Modus: ${toolName}`,
  };
};

export type AgentLegOutcome =
  | { kind: "deferred"; sessionId: string }
  | { kind: "completed"; sessionId: string; summary: string; costUsd: number }
  | { kind: "error"; sessionId: string | null; message: string };

// Beim Fortsetzen einer per PreToolUse-Hook deferred-en Session darf KEIN
// neuer User-Turn injiziert werden -- ein leerer Async-Iterable setzt nur
// die pausierte Session fort, statt eine neue Anfrage zu stellen.
// UNVERIFIZIERT gegen das echte Node-SDK-Verhalten (aus Community-Recherche
// uebernommen, nicht aus einem direkt zitierten Dokubeispiel) -- der
// Phase-1-Realvideo-Test MUSS bestaetigen, dass das Fortsetzen tatsaechlich
// funktioniert, bevor darauf vertraut wird.
async function* emptyResumePrompt(): AsyncIterable<never> {}

export async function runAgentLeg(params: {
  supabase: SupabaseClient;
  jobId: string;
  prompt: string;
  sessionId: string;
  resume: boolean;
}): Promise<AgentLegOutcome> {
  const { supabase, jobId, prompt, sessionId, resume } = params;

  const options: Options = {
    cwd: "C:\\Videotool",
    settingSources: ["project"], // laedt CLAUDE.md automatisch
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: SYSTEM_PROMPT_ADDENDUM,
    },
    disallowedTools: ["AskUserQuestion"],
    canUseTool: allowlistCanUseTool,
    mcpServers: {
      [CHECKPOINT_SERVER_NAME]: createCheckpointMcpServer(),
    },
    hooks: {
      PreToolUse: [
        {
          matcher: CHECKPOINT_HOOK_MATCHER,
          hooks: [createCheckpointHook(supabase, jobId)],
        },
      ],
    },
    maxTurns: 60,
    maxBudgetUsd: 5,
    ...(resume ? { resume: sessionId } : { sessionId }),
  };

  let lastSessionId: string | null = sessionId;
  const queryPrompt = resume ? emptyResumePrompt() : prompt;

  try {
    for await (const message of query({ prompt: queryPrompt, options }) as AsyncGenerator<SDKMessage>) {
      if (message.type !== "result") {
        continue;
      }

      lastSessionId = message.session_id;

      if (message.terminal_reason === "tool_deferred") {
        return { kind: "deferred", sessionId: message.session_id };
      }

      if (message.subtype === "success") {
        if (message.is_error) {
          return { kind: "error", sessionId: message.session_id, message: message.result };
        }
        return {
          kind: "completed",
          sessionId: message.session_id,
          summary: message.result,
          costUsd: message.total_cost_usd,
        };
      }

      // subtype ist einer der Fehler-Subtypen (error_during_execution, error_max_turns, ...)
      return {
        kind: "error",
        sessionId: message.session_id,
        message: message.errors.join("; ") || `Turn beendet: ${message.subtype}`,
      };
    }

    return { kind: "error", sessionId: lastSessionId, message: "Stream endete ohne result-Message." };
  } catch (err) {
    return {
      kind: "error",
      sessionId: lastSessionId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
