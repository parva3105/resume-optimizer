"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check } from "lucide-react";

const STORAGE_KEY = "resumeopt:last-run:v1";

function safeParse<T>(s: string | null): T | null {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

function saveLater(fn: () => void) {
  let t: any;
  return () => { clearTimeout(t); t = setTimeout(fn, 400); }; // 400ms debounce
}

export default function ResumeForm() {
  const [jd, setJd] = React.useState("");
  const [latex, setLatex] = React.useState("");
  const [model, setModel] = React.useState("gpt-4o-mini");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<null | { optimizedLatex?: string; log?: string }>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const data = safeParse<{ jd:string; latex:string; model:string; notes:string; optimizedLatex?:string }>(
      localStorage.getItem(STORAGE_KEY)
    );
    if (data) {
      setJd(data.jd ?? "");
      setLatex(data.latex ?? "");
      setModel(data.model ?? "gpt-4o-mini");
      setNotes(data.notes ?? "");
      if (data.optimizedLatex) setResult({ optimizedLatex: data.optimizedLatex });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedSave = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    debouncedSave.current = saveLater(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          jd, latex, model, notes,
          optimizedLatex: result?.optimizedLatex || "",
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  React.useEffect(() => {
    debouncedSave.current?.();
  }, [jd, latex, model, notes, result?.optimizedLatex]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/optimize", {
        method : "POST",
        headers: {"Content-Type" :  "application/json"},
        body: JSON.stringify({ jobDescription: jd, latex, model, notes }),
      });
      if(!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      console.log("API /optimize response:", data);
      setResult(data);
    } catch(err: any) {
      setApiError(err.message || "Request Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyOptimized() {
    if (!result?.optimizedLatex) return;
    try {
      await navigator.clipboard.writeText(result.optimizedLatex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = result.optimizedLatex;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resume Optimizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jd"> Job Description </Label>
            <Textarea
              id="jd"
              placeholder="Paste the Job Description"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              className="h-[50vh] overflow-auto font-mono resize-none"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="latex">LaTeX Resume</Label>
            {/* Fixed-height, internally scrollable textarea */}
            <Textarea
              id="latex"
              placeholder="Paste your LaTeX resume source..."
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className="h-[50vh] overflow-auto font-mono resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Constraints or preferences to guide optimization"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Optimizing..." : "Optimize Resume"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setJd(""); setLatex(""); setResult(null); setApiError(null); setNotes("");
              }}
            >
              Reset
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setJd(""); setLatex(""); setNotes("");
                setResult(null); setApiError(null);
              }}
            >
              Clear saved
            </Button>
          </div>

          {apiError && (
            <Alert variant="destructive" className="max-w-5xl">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                The action failed.{" "}
                <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setShowErrorDialog(true)}
                    >
                      View details
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Error details</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] w-full rounded border p-3">
                      <pre className="whitespace-pre-wrap text-xs leading-5">
                        {apiError}
                      </pre>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </AlertDescription>
            </Alert>
          )}

          {result?.optimizedLatex && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Optimized LaTeX (preview)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyOptimized}
                  aria-label="Copy optimized LaTeX"
                >
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Textarea readOnly className="min-h-60 font-mono" value={result.optimizedLatex} />
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
