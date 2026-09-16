import { NextResponse } from "next/server";
import { FlowError } from "@/lib/flow";

/** Uniform JSON error handling for the API routes. */
export function apiError(err: unknown): NextResponse {
  if (err instanceof FlowError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
