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

interface Team { id: number; club: string }
interface Matchweek { id: number; week: number; seasonId: number }
interface Season { id: number; year: number }
interface Schedule {
  id: number;
  gameNumber: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
}

export default function SchedulePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [matchweeks, setMatchweeks] = useState<Matchweek[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedMwId, setSelectedMwId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState({
    homeTeamId: "",
    awayTeamId: "",
    homeScore: "",
    awayScore: "",
    gameNumber: "",
  });

  async function loadBase() {
    const [sRes, tRes] = await Promise.all([
      fetch("/api/admin/seasons"),
      fetch("/api/admin/teams"),
    ]);
    const s: Season[] = await sRes.json();
    setSeasons(s);
    setTeams(await tRes.json());
    if (s.length > 0) setSelectedSeasonId(s[0].id.toString());
  }

  async function loadMatchweeks(seasonId: string) {
    const res = await fetch(`/api/admin/matchweeks?seasonId=${seasonId}`);
    const mws: Matchweek[] = await res.json();
    setMatchweeks(mws);
    if (mws.length > 0) setSelectedMwId(mws[0].id.toString());
    else setSelectedMwId("");
  }

  async function loadSchedules(mwId: string) {
    if (!mwId) { setSchedules([]); return; }
    const res = await fetch(`/api/admin/schedule?matchweekId=${mwId}`);
    setSchedules(await res.json());
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedSeasonId) loadMatchweeks(selectedSeasonId); }, [selectedSeasonId]);
  useEffect(() => { loadSchedules(selectedMwId); }, [selectedMwId]);

  function openCreate() {
    setEditing(null);
    setForm({
      homeTeamId: teams[0]?.id.toString() ?? "",
      awayTeamId: teams[1]?.id.toString() ?? "",
      homeScore: "",
      awayScore: "",
      gameNumber: String(schedules.length + 1),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <Button onClick={openCreate} disabled={!selectedMwId}>Add Fixture</Button>
      </div>

      <div className="flex gap-4">
        <div className="w-40">
          <label className="text-sm font-medium block mb-1">Season</label>
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.year}</SelectItem>
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.gameNumber}</TableCell>
              <TableCell>{s.homeTeam.club}</TableCell>
              <TableCell>
                {s.homeScore != null && s.awayScore != null
                  ? `${s.homeScore} – ${s.awayScore}`
                  : "– – –"}
              </TableCell>
              <TableCell>{s.awayTeam.club}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(s.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
          {schedules.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
