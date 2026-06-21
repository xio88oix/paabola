"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Team { id: number; club: string; logo?: string | null }
interface Matchweek { id: number; week: number; seasonId: number }
interface BetWeek { id: number; week: number; seasonId: number }
interface Season { id: number; year: string; status: string }
interface Schedule {
  id: number;
  gameNumber: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  betWeek?: BetWeek | null;
}

function TeamCell({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2">
      {team.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt={team.club} width={20} height={20} className="h-5 w-5 object-contain" />
      )}
      <span>{team.club}</span>
    </div>
  );
}

export default function SchedulePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [matchweeks, setMatchweeks] = useState<Matchweek[]>([]);
  const [betweeks, setBetweeks] = useState<BetWeek[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedMwId, setSelectedMwId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState({
    homeTeamId: "",
    awayTeamId: "",
    homeScore: "",
    awayScore: "",
    gameNumber: "",
    betWeekId: "",
  });

  async function loadBase() {
    const [sRes, tRes] = await Promise.all([
      fetch("/api/admin/seasons"),
      fetch("/api/admin/teams"),
    ]);
    const s: Season[] = await sRes.json();
    setSeasons(s);
    setTeams(await tRes.json());
    if (s.length > 0) {
      const openSeason = s.find((x) => x.status === "open") ?? s[0];
      setSelectedSeasonId(openSeason.id.toString());
    }
  }

  async function loadWeeks(seasonId: string) {
    const [mwRes, bwRes] = await Promise.all([
      fetch(`/api/admin/matchweeks?seasonId=${seasonId}`),
      fetch(`/api/admin/betweeks?seasonId=${seasonId}`),
    ]);
    const mws: Matchweek[] = await mwRes.json();
    setMatchweeks(mws);
    setBetweeks(await bwRes.json());
    if (mws.length > 0) setSelectedMwId(mws[0].id.toString());
    else setSelectedMwId("");
  }

  async function loadSchedules(mwId: string) {
    if (!mwId) { setSchedules([]); return; }
    const res = await fetch(`/api/admin/schedule?matchweekId=${mwId}`);
    setSchedules(await res.json());
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedSeasonId) loadWeeks(selectedSeasonId); }, [selectedSeasonId]);
  useEffect(() => { loadSchedules(selectedMwId); }, [selectedMwId]);

  // The betweek that matches the currently selected matchweek's week number (default sync)
  function defaultBetWeekId(): string {
    const mw = matchweeks.find((m) => m.id === parseInt(selectedMwId));
    const match = mw ? betweeks.find((b) => b.week === mw.week) : undefined;
    return (match ?? betweeks[0])?.id.toString() ?? "";
  }

  function openCreate() {
    setEditing(null);
    setForm({
      homeTeamId: teams[0]?.id.toString() ?? "",
      awayTeamId: teams[1]?.id.toString() ?? "",
      homeScore: "",
      awayScore: "",
      gameNumber: String(schedules.length + 1),
      betWeekId: defaultBetWeekId(),
    });
    setOpen(true);
  }

  function openEdit(s: Schedule) {
    setEditing(s);
    setForm({
      homeTeamId: s.homeTeam.id.toString(),
      awayTeamId: s.awayTeam.id.toString(),
      homeScore: s.homeScore != null ? String(s.homeScore) : "",
      awayScore: s.awayScore != null ? String(s.awayScore) : "",
      gameNumber: String(s.gameNumber),
      betWeekId: s.betWeek?.id.toString() ?? defaultBetWeekId(),
    });
    setOpen(true);
  }

  function parseScore(v: string) { return v === "" ? null : parseInt(v); }

  async function save() {
    const selectedMw = matchweeks.find((m) => m.id === parseInt(selectedMwId));
    if (!selectedMw) return;

    const payload = {
      homeTeamId: parseInt(form.homeTeamId),
      awayTeamId: parseInt(form.awayTeamId),
      homeScore: parseScore(form.homeScore),
      awayScore: parseScore(form.awayScore),
      gameNumber: parseInt(form.gameNumber),
      seasonId: selectedMw.seasonId,
      matchweekId: selectedMw.id,
      betWeekId: form.betWeekId ? parseInt(form.betWeekId) : undefined,
    };

    if (editing) {
      await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
    } else {
      await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setOpen(false);
    loadSchedules(selectedMwId);
  }

  async function remove(id: number) {
    if (!confirm("Delete this fixture?")) return;
    await fetch("/api/admin/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSchedules(selectedMwId);
  }

  async function importSeason() {
    if (!confirm(
      "Import the full Premier League schedule for the OPEN season from football-data.org?\n\n" +
      "This rebuilds that season's matchweeks, betweeks and fixtures (and downloads team crests). " +
      "Only allowed before any picks have been made."
    )) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import/schedule", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Import failed."); return; }
      alert(
        `Imported ${data.schedules} fixtures across ${data.matchweeks} matchweeks for ${data.season}.\n` +
        `Teams created: ${data.teamsCreated}. Finished games with scores: ${data.finishedWithScores}.`
      );
      await loadBase();
      if (selectedSeasonId) await loadWeeks(selectedSeasonId);
    } finally {
      setBusy(false);
    }
  }

  async function syncResults() {
    const mw = matchweeks.find((m) => m.id === parseInt(selectedMwId));
    if (!mw) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchday: mw.week }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Sync failed."); return; }
      alert(
        `Matchday ${data.matchday}: ${data.updated} fixtures updated from ${data.finishedReturned} finished games` +
        (data.notFound ? ` (${data.notFound} not matched — import the season first).` : ".")
      );
      loadSchedules(selectedMwId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={importSeason} disabled={busy}>
            Import season from API
          </Button>
          <Button variant="outline" onClick={syncResults} disabled={busy || !selectedMwId}>
            Sync results
          </Button>
          <Button onClick={openCreate} disabled={!selectedMwId}>Add Fixture</Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-40">
          <label className="text-sm font-medium block mb-1">Season</label>
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.year}{s.status === "open" ? " (open)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="text-sm font-medium block mb-1">Matchweek</label>
          <Select value={selectedMwId} onValueChange={setSelectedMwId}>
            <SelectTrigger><SelectValue placeholder="Matchweek" /></SelectTrigger>
            <SelectContent>
              {matchweeks.map((mw) => (
                <SelectItem key={mw.id} value={mw.id.toString()}>MW {mw.week}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Home</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Away</TableHead>
            <TableHead>Betweek</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.gameNumber}</TableCell>
              <TableCell><TeamCell team={s.homeTeam} /></TableCell>
              <TableCell>
                {s.homeScore != null && s.awayScore != null
                  ? `${s.homeScore} – ${s.awayScore}`
                  : "– – –"}
              </TableCell>
              <TableCell><TeamCell team={s.awayTeam} /></TableCell>
              <TableCell>{s.betWeek ? `BW ${s.betWeek.week}` : "—"}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(s.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
          {schedules.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No fixtures for this matchweek.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Fixture" : "Add Fixture"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Game #</label>
              <Input
                type="number"
                value={form.gameNumber}
                onChange={(e) => setForm({ ...form, gameNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Home Team</label>
              <Select value={form.homeTeamId} onValueChange={(v) => setForm({ ...form, homeTeamId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.club}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Away Team</label>
              <Select value={form.awayTeamId} onValueChange={(v) => setForm({ ...form, awayTeamId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.club}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Betweek</label>
              <Select value={form.betWeekId} onValueChange={(v) => setForm({ ...form, betWeekId: v })}>
                <SelectTrigger><SelectValue placeholder="Select betweek" /></SelectTrigger>
                <SelectContent>
                  {betweeks.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>BW {b.week}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Home Score</label>
                <Input
                  type="number"
                  min={0}
                  value={form.homeScore}
                  onChange={(e) => setForm({ ...form, homeScore: e.target.value })}
                  placeholder="–"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Away Score</label>
                <Input
                  type="number"
                  min={0}
                  value={form.awayScore}
                  onChange={(e) => setForm({ ...form, awayScore: e.target.value })}
                  placeholder="–"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
