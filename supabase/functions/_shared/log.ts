import { DEBUG_PARSING } from "./constants.ts";

// One log shape for the whole backend pipeline, mirroring the app's
// fetch-fallback/log so every line for a single item can be grepped by
// `item=<id>`:
//
//   <iso-timestamp> [shelf:<stage>] item=<id> <event> <detail?>
//
// e.g. 2026-06-20T12:34:56.789Z [shelf:fetch] item=abc123 done status=fetched hasBody=true
//
// error/info always print; debug is gated by DEBUG_PARSING (the verbose dumps).
// Strings pass through verbatim, Errors reduce to their message, everything else
// is JSON-stringified — kept to a single line so grep-by-item stays intact.
export interface Logger {
  info(event: string, detail?: unknown): void;
  error(event: string, detail?: unknown): void;
  debug(event: string, detail?: unknown): void;
}

export function makeLogger(stage: string, itemId: string): Logger {
  const fmt = (event: string, detail?: unknown) =>
    `${new Date().toISOString()} [shelf:${stage}] item=${itemId} ${event}${render(detail)}`;
  return {
    info: (event, detail) => console.log(fmt(event, detail)),
    error: (event, detail) => console.error(fmt(event, detail)),
    debug: (event, detail) => {
      if (DEBUG_PARSING) console.log(fmt(event, detail));
    },
  };
}

function render(detail: unknown): string {
  if (detail === undefined) return "";
  if (typeof detail === "string") return ` ${detail}`;
  if (detail instanceof Error) return ` ${detail.message}`;
  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ` ${String(detail)}`;
  }
}
