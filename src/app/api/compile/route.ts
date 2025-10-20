import { NextResponse } from "next/server";
import { compileLatexToPdf } from "@/lib/latex";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { latex } = await req.json();
    if (!latex || typeof latex !== "string") {
      return new NextResponse("Missing latex", { status: 400 });
    }

    const pdf = await compileLatexToPdf(latex); // <- Buffer
    const u8 = new Uint8Array(pdf);            // <- convert for TS

    return new NextResponse(u8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Compile Error:", err);
    return new NextResponse(err?.message || "Compile Failed", { status: 500 });
  }
}