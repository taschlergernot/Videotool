import { z } from "zod";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

export const CHECKPOINT_SERVER_NAME = "videotool_checkpoint";
export const CHECKPOINT_TOOL_NAME = "submit_checkpoint";

export const checkpointInputShape = {
  checkpoint_type: z.enum(["cut_plan", "self_eval"]),
  title_de: z.string(),
  summary_de: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
};

// Die eigentliche Warte-auf-Freigabe-Logik passiert im PreToolUse-Hook
// (checkpointHook.ts) via defer/resume -- wird dieser Handler ueberhaupt
// aufgerufen, ist der Checkpoint schon freigegeben.
export function createCheckpointMcpServer() {
  return createSdkMcpServer({
    name: CHECKPOINT_SERVER_NAME,
    version: "1.0.0",
    // Ohne das werden SDK-MCP-Tools per Default "deferred" (hinter einer
    // ToolSearch versteckt, erst beim ersten Turn evtl. noch nicht geladen).
    // Zwei echte Testlaeufe sind genau daran gescheitert -- No such tool
    // available -- trotz korrektem Namen und korrekter canUseTool-Freigabe.
    alwaysLoad: true,
    tools: [
      tool(
        CHECKPOINT_TOOL_NAME,
        "Legt einen Pflicht-Checkpoint an (Cut-Plan-Bestaetigung oder Self-Eval, siehe CLAUDE.md) " +
          "und wartet auf die Freigabe des Nutzers ueber die Web-App, bevor die Bearbeitung " +
          "fortgesetzt wird. Fuer jeden dokumentierten Pflicht-Checkpoint zwingend zu nutzen -- " +
          "niemals als Fliesstext oder AskUserQuestion fragen, es gibt keinen Chat-Partner.",
        checkpointInputShape,
        async () => ({
          content: [{ type: "text" as const, text: "Checkpoint freigegeben." }],
        }),
        { alwaysLoad: true }
      ),
    ],
  });
}
