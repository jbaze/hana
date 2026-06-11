import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_RUNS, runBenchmark } from "@/lib/benchmark";
import { getQuery } from "@/lib/queries";

// Native HANA client → Node.js runtime is mandatory, never edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Full battery with many runs can take a while on cold free-tier instances.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { queryId?: string; runs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = getQuery(body.queryId ?? "");
  if (!query) {
    return NextResponse.json(
      { error: `Unknown queryId "${body.queryId}"` },
      { status: 400 }
    );
  }

  const runs =
    typeof body.runs === "number" && Number.isFinite(body.runs)
      ? body.runs
      : DEFAULT_RUNS;

  const result = await runBenchmark(query, runs);
  return NextResponse.json(result);
}
