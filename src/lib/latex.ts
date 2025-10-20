import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const pExecFile = promisify(execFile);

/** Basic hardening: block shell escapes */
function sanitizeInput(tex: string) {
  if (tex.includes("\\write18")) throw new Error("Forbidden LaTeX command (\\write18)");
  return tex;
}

/** Add safe, common packages or wrap bare content so MiKTeX compiles reliably */
function normalizeLatex(src: string): string {
  // If there is no \documentclass, wrap the content in a minimal document
  if (!/\\documentclass/.test(src)) {
    return [
      "\\documentclass[10pt]{article}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage{lmodern}",
      "\\usepackage{microtype}",
      "\\usepackage{hyperref}",
      "\\usepackage{url}",
      "\\begin{document}",
      src.trim(),
      "\\end{document}",
    ].join("\n");
  }

  let s = src;
  const needs = [
    { re: /\\usepackage(\[[^\]]*])?\{inputenc\}/, add: "\\usepackage[utf8]{inputenc}" },
    { re: /\\usepackage(\[[^\]]*])?\{fontenc\}/, add: "\\usepackage[T1]{fontenc}" },
    { re: /\\usepackage\{lmodern\}/, add: "\\usepackage{lmodern}" },
    { re: /\\usepackage\{microtype\}/, add: "\\usepackage{microtype}" },
    { re: /\\usepackage\{hyperref\}/, add: "\\usepackage{hyperref}" },
    { re: /\\usepackage\{url\}/, add: "\\usepackage{url}" },
  ];

  const lines = s.split(/\r?\n/);
  const docIdx = lines.findIndex(l => /\\documentclass/.test(l));
  if (docIdx !== -1) {
    const toInsert: string[] = [];
    for (const { re, add } of needs) {
      if (!re.test(s)) toInsert.push(add);
    }
    if (toInsert.length) {
      lines.splice(docIdx + 1, 0, ...toInsert);
      s = lines.join("\n");
    }
  }

  return s;
}

async function runPdflatexOnce(dir: string, filename: string) {
    try {
      await pExecFile("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", filename], {
        cwd: dir,
        windowsHide: true,
        timeout: 60_000,
      });
    } catch (err: any) {
      const logPath = path.join(dir, filename.replace(/\.tex$/, ".log"));
      const log = await fs.readFile(logPath).then(b => b.toString()).catch(() => "");
      const out = [
        err?.stdout ? `\n--- stdout ---\n${err.stdout}` : "",
        err?.stderr ? `\n--- stderr ---\n${err.stderr}` : "",
      ].join("");
      // show the whole log for now; we'll shrink it later
      throw new Error(`LaTeX compile failed (pdflatex):\n${log || out || "(no log available)"}`);
    }
}


export async function compileLatexToPdf(latexSource: string): Promise<Buffer> {
  // Sanitize + normalize before writing the .tex
  const safe = sanitizeInput(normalizeLatex(latexSource));

  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "resumeopt-"));
  const texFile = path.join(workdir, "main.tex");
  await fs.writeFile(texFile, safe, "utf8");

  // Two passes for refs/TOC stability
  await runPdflatexOnce(workdir, "main.tex");
  await runPdflatexOnce(workdir, "main.tex");

  const pdf = await fs.readFile(path.join(workdir, "main.pdf"));
  try {
    await fs.rm(workdir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
  return pdf;
}
