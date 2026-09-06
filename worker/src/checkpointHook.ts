import type {
  HookCallback,
  PreToolUseHookInput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKPOINT_SERVER_NAME, CHECKPOINT_TOOL_NAME } from "./checkpointTool.js";

export const CHECKPOINT_HOOK_MATCHER = `mcp__${CHECKPOINT_SERVER_NAME}__${CHECKPOINT_TOOL_NAME}`;

type CheckpointArgs = {
  checkpoint_type: "cut_plan" | "self_eval";
  title_de: string;
  summary_de: string;
  payload?: Record<string, unknown>;
};

function defer(): SyncHookJSONOutput {
  return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "defer" },
  };
}

// PreToolUse-Hook fuer den submit_checkpoint-Tool-Call: legt beim ersten
// Aufruf einen job_checkpoints-Eintrag an und deferred die query() sauber
// (kein offener Prozess); ein spaeterer Aufruf mit derselben tool_use_id
// (nach `resume`) prueft den DB-Status und gibt allow/deny/erneut defer
// zurueck -- das ist der komplette Pause-und-Fortsetzen-Mechanismus.
export function createCheckpointHook(supabase: SupabaseClient, jobId: string): HookCallback {
  return async (input, toolUseID) => {
    const hookInput = input as PreToolUseHookInput;
    const toolUseId = toolUseID ?? hookInput.tool_use_id;

    const { data: existing } = await supabase
      .from("job_checkpoints")
      .select("*")
      .eq("tool_use_id", toolUseId)
      .maybeSingle();

    if (!existing) {
      const args = hookInput.tool_input as CheckpointArgs;

      const { count } = await supabase
        .from("job_checkpoints")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId);

      await supabase.from("job_checkpoints").insert({
        job_id: jobId,
        seq: (count ?? 0) + 1,
        type: args.checkpoint_type,
        title_de: args.title_de,
        summary_de: args.summary_de,
        payload: args.payload ?? {},
        tool_use_id: toolUseId,
      });

      await supabase.from("jobs").update({ status: "awaiting_approval" }).eq("id", jobId);

      return defer();
    }

    if (existing.status === "approved" || existing.status === "edited") {
      const originalInput = hookInput.tool_input as Record<string, unknown>;
      const out: SyncHookJSONOutput = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: {
            ...originalInput,
            payload: existing.decision_payload ?? originalInput.payload,
          },
        },
      };
      return out;
    }

    if (existing.status === "rejected") {
      const note = (existing.decision_payload as { note?: string } | null)?.note;
      const out: SyncHookJSONOutput = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: note ?? "Nutzer hat den Vorschlag abgelehnt.",
        },
      };
      return out;
    }

    // status === 'pending' -- noch keine Entscheidung, weiter warten.
    return defer();
  };
}
