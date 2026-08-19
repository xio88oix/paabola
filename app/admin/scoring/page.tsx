"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ScoringPage() {
  const [exact, setExact] = useState("");
  const [correct, setCorrect] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/scoring");
    const c = await res.json();
    setExact(String(c.exactScorePoints));
    setCorrect(String(c.correctResultPoints));
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaved(false);
    await fetch("/api/admin/scoring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exactScorePoints: parseInt(exact),
        correctResultPoints: parseInt(correct),
      }),
    });
    setSaved(true);
  }

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Scoring</h1>
      <p className="text-sm text-muted-foreground">
        Points awarded per pick. Changes apply the next time a betweek is completed
        (or re-completed).
      </p>
      <div>
        <label className="text-sm font-medium block mb-1">Exact score points</label>
        <Input
          type="number"
          min={0}
          value={exact}
          onChange={(e) => { setExact(e.target.value); setSaved(false); }}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Correct result points</label>
        <Input
          type="number"
          min={0}
          value={correct}
          onChange={(e) => { setCorrect(e.target.value); setSaved(false); }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save}>Save</Button>
        {saved && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </div>
  );
}
