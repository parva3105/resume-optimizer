// src/app/api/optimize/route.ts

import { NextResponse } from "next/server";
import { buildMessages, PROMPT_VERSION } from "@/lib/prompt";
import { openai } from "@/lib/openai";
import { log } from "console";

//OpenAI SDK needs node!
export const runtime = "nodejs";

function stripMarkdownFences(s: string) {
    const m = s.trim().match(/^```(?:latex)?\s*([\s\S]*?)\s*```$/i);
    return m ? m[1] : s;
  }

export async function POST(req: Request) {
    try{
        const { jobDescription, latex, model = "gpt-4o-mini", notes} = await req.json();

        if(!jobDescription || !latex) {
            return new NextResponse("Missign Job Description or LaTeX", {status: 400});
        }

        const messages = buildMessages({
            jobDescription,
            latex,
            userNotes: notes,
        });

        const completion = await openai.chat.completions.create({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 6000,
        });

        const text = completion.choices?.[0]?.message?.content ?? "";
        const optimizedLatex = stripMarkdownFences(text);

        if(!optimizedLatex) {
            return new NextResponse("Emplty Response from the Model", { status : 502 });
        }
        return NextResponse.json({ ok: true, optimizedLatex});
    } catch (err: any) {
        console.log("optimize error: ", err);
        return new NextResponse(err?.message || "Server Error", { status: 500});
    }
}
  

// export async function POST(req: Request) {
//     const { jobDescription, latex, model = "gpt-4o-mini", notes } = await req.json();

//     if(!jobDescription || !latex) {
//         return new NextResponse("Missign Job Description or LaTeX", {status: 400});
//     }

//     //Build messages to be sent to LLM
//     const messages = buildMessages({
//         jobDescription,
//         latex,
//         userNotes: notes,
//     });

//     //replace with actuall LLM call
//     //checking structure phase 1
//     return NextResponse.json({
//         ok: true,
//         model,
//         PROMPT_VERSION: process.env.PROMPT_VERSION?? "1",
//         preview: {
//             system: messages[0].content.slice(0,200) + "...",
//             user: messages[1].content.slice(0,200) + "...",
//         },
//         //placeholder to not break the UI
//         optimizedLatex: ""
//     })

// }