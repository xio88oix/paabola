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

interface BetWeek { id: number; week: number; status: string; season: { year: string } }
interface Season { id: number; year: string }

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline",
  active: "secondary",
  completed: "default",
};

export default function BetweeksPage() {
  const [betweeks, setBetweeks] = useState<BetWeek[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BetWeek | null>(null);
  const [form, setForm] = useState({ week: "", status: "open", seasonId: "" });

  async function load() {
    const [bwRes, sRes] = await Promise.all([
      fetch("/api/admin/betweeks"),
      fetch("/api/admin/seasons"),
    ]);
    setBetweeks(await bwRes.json());
    setSeasons(await sRes.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ week: "", status: "open", seasonId: seasons[0]?.id.toString() ?? "" });
    setOpen(true);
  }

  function openEdit(bw: BetWeek) {
    setEditing(bw);
    setForm({ week: String(bw.week), status: bw.status, seasonId: "" });
    setOpen(true);
  }

  async function save() {
    const payload = {
      week: parseInt(form.week),
      status: form.status,
      seasonId: parseInt(form.seasonId),
    };
    if (editing) {
      await fetch("/api/admin/betweeks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
    } else {
      await fetch("/api/admin/betweeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setOpen(false);
    load();
  }

  async function changeStatus(bw: BetWeek, status: string) {
    if (status === "completed") {
      if (!confirm(`Mark Betweek ${bw.week} as completed? This will calculate all points.`)) return;
    }
    await fetch("/api/admin/betweeks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bw.id, week: bw.week, status, seasonId: undefined }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this betweek?")) return;
    const res = await fetch("/api/admin/betweeks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not delete betweek.");
    }
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Betweeks</h1>
        <Button onClick={openCreate}>Add Betweek</Button>
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
          {betweeks.map((bw) => (
            <TableRow key={bw.id}>
              <TableCell>{bw.season.year}</TableCell>
              <TableCell>BW {bw.week}</TableCell>
              <TableCell>
                <Badge variant={STATUS_COLORS[bw.status] ?? "outline"}>
                  {bw.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  {bw.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(bw, "active")}>
                      Set Active
                    </Button>
                  )}
                  {bw.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(bw, "completed")}>
                      Complete
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(bw)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(bw.id)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Betweek" : "Add Betweek"}</DialogTitle>
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
