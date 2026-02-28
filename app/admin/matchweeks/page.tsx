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
import { Badge } from "@/components/ui/badge";

interface Matchweek { id: number; week: number; status: string; season: { year: number } }
interface Season { id: number; year: number }

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline",
  active: "secondary",
  completed: "default",
};

export default function MatchweeksPage() {
  const [matchweeks, setMatchweeks] = useState<Matchweek[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Matchweek | null>(null);
  const [form, setForm] = useState({ week: "", status: "open", seasonId: "" });

  async function load() {
    const [mwRes, sRes] = await Promise.all([
      fetch("/api/admin/matchweeks"),
      fetch("/api/admin/seasons"),
    ]);
    setMatchweeks(await mwRes.json());
    setSeasons(await sRes.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ week: "", status: "open", seasonId: seasons[0]?.id.toString() ?? "" });
    setOpen(true);
  }

  function openEdit(mw: Matchweek) {
    setEditing(mw);
    setForm({ week: String(mw.week), status: mw.status, seasonId: "" });
    setOpen(true);
  }

  async function save() {
    const payload = {
      week: parseInt(form.week),
      status: form.status,
      seasonId: parseInt(form.seasonId),
    };
    if (editing) {
      await fetch("/api/admin/matchweeks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
    } else {
      await fetch("/api/admin/matchweeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setOpen(false);
    load();
  }

  async function changeStatus(mw: Matchweek, status: string) {
    if (status === "completed") {
      if (!confirm(`Mark Matchweek ${mw.week} as completed? This will calculate all points.`)) return;
    }
    await fetch("/api/admin/matchweeks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mw.id, week: mw.week, status, seasonId: undefined }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this matchweek and all its schedules?")) return;
    await fetch("/api/admin/matchweeks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matchweeks</h1>
        <Button onClick={openCreate}>Add Matchweek</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Season</TableHead>
            <TableHead>Week</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matchweeks.map((mw) => (
            <TableRow key={mw.id}>
              <TableCell>{mw.season.year}</TableCell>
              <TableCell>MW {mw.week}</TableCell>
              <TableCell>
                <Badge variant={STATUS_COLORS[mw.status] ?? "outline"}>
                  {mw.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  {mw.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(mw, "active")}>
                      Set Active
                    </Button>
                  )}
                  {mw.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(mw, "completed")}>
                      Complete
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(mw)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(mw.id)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Matchweek" : "Add Matchweek"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Season</label>
              <Select value={form.seasonId} onValueChange={(v) => setForm({ ...form, seasonId: v })}>
                <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Week Number</label>
              <Input
                type="number"
                value={form.week}
                onChange={(e) => setForm({ ...form, week: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">open</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="completed">completed</SelectItem>
                </SelectContent>
              </Select>
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
