import type {
  HookCallback,
  PreToolUseHookInput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Vorherige Designs (custom MCP-Tool "submit_checkpoint", mit und ohne
// alwaysLoad auf Tool- UND Server-Ebene) sind an vier echten Testlaeufen in
// Folge exakt an derselben Stelle gescheitert: das Tool war weder in der
// initialen Tool-Liste noch ueber ToolSearch erreichbar. Root Cause nie
// zweifelsfrei geklaert (widerspricht sogar den eigenen SDK-Typkommentaren),
// aber reproduzierbar genug, um den Ansatz aufzugeben statt weiter zu patchen.
// Stattdessen haengt der Checkpoint jetzt am eingebauten "Write"-Tool -- das
// ist nie deferred, weil es Teil des claude_code-Presets ist, keine separate
// MCP-Registrierung braucht.
export const CHECKPOINT_HOOK_MATCHER = "Write";

const CHECKPOINT_PATH_RE = /\.worker_checkpoints[\\/][^\\/]+[\\/](cut_plan|self_eval)\.json$/i;

type CheckpointBody = {
  title_de: string;
  summary_de: string;
  payload?: Record<string, unknown>;
};

function pass(): SyncHookJSONOutput {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } };
}

function defer(): SyncHookJSONOutput {
  return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "defer" },
  };
}

// PreToolUse-Hook fuer Write-Aufrufe nach .worker_checkpoints/<jobId>/{cut_plan,self_eval}.json:
// legt beim ersten Aufruf einen job_checkpoints-Eintrag an und deferred die
// query() sauber (kein offener Prozess); ein spaeterer Aufruf mit derselben
// tool_use_id (nach `resume`) prueft den DB-Status und gibt allow/deny/erneut
// defer zurueck. Jeder Write auf einen anderen Pfad laeuft normal durch.
export function createCheckpointHook(supabase: SupabaseClient, jobId: string): HookCallback {
  return async (input, toolUseID) => {
    const hookInput = input as PreToolUseHookInput;
    const filePath = String((hookInput.tool_input as { file_path?: string })?.file_path ?? "");

    const match = filePath.match(CHECKPOINT_PATH_RE);
    if (!match) {
      return pass();
    }
    const checkpointType = match[1] as "cut_plan" | "self_eval";
    const toolUseId = toolUseID ?? hookInput.tool_use_id;

    const { data: existing } = await supabase
      .from("job_checkpoints")
      .select("*")
      .eq("tool_use_id", toolUseId)
      .maybeSingle();

    if (!existing) {
      let body: CheckpointBody;
      try {
        body = JSON.parse(String((hookInput.tool_input as { content?: string })?.content ?? "{}"));
      } catch {
        body = { title_de: "Checkpoint", summary_de: "(ungueltiges JSON vom Agent)" };
      }

      const { count } = await supabase
        .from("job_checkpoints")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId);

      await supabase.from("job_checkpoints").insert({
        job_id: jobId,
        seq: (count ?? 0) + 1,
        type: checkpointType,
        title_de: body.title_de,
        summary_de: body.summary_de,
        payload: body.payload ?? {},
        tool_use_id: toolUseId,
      });

      await supabase.from("jobs").update({ status: "awaiting_approval" }).eq("id", jobId);

      return defer();
    }

    if (existing.status === "approved" || existing.status === "edited") {
      // Der Write darf durch -- die Datei selbst ist nur der Transportweg fuer
      // die Anfrage, ihr Inhalt ist fuer den weiteren Ablauf irrelevant. Editierte
      // Werte liest der Agent stattdessen ueber den naechsten Prompt/State, falls
      // noetig -- fuer Phase 1 reicht "approved" als reines Freigabesignal.
      return pass();
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
