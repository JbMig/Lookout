import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";

export async function GET() {
  return NextResponse.json({ demo: isDemo });
}
