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

interface Season { id: number; year: string; status: string }
interface DeleteImpact { year: string; counts: { matchweeks: number; betweeks: number; schedules: number; picks: number } }

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [form, setForm] = useState({ year: "", status: "open" });
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/seasons");
    setSeasons(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ year: "", status: "open" });
    setOpen(true);
  }

  function openEdit(s: Season) {
    setEditing(s);
    setForm({ year: s.year, status: s.status });
    setOpen(true);
  }

  async function save() {
    if (editing) {
      await fetch("/api/admin/seasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, year: form.year, status: form.status }),
      });
    } else {
      await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: form.year, status: form.status }),
      });
    }
    setOpen(false);
    load();
  }

  // Step 1: ask the server what deleting this season would wipe, then show the confirm dialog.
  async function askRemove(s: Season) {
    const res = await fetch("/api/admin/seasons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setDeleteTarget(s);
    setDeleteImpact({ year: data.year ?? s.year, counts: data.counts });
  }

  // Step 2: user confirmed — actually cascade delete.
  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch("/api/admin/seasons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id, confirm: true }),
    });
    setDeleting(false);
    setDeleteTarget(null);
    setDeleteImpact(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seasons</h1>
        <Button onClick={openCreate}>Add Season</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seasons.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.year}</TableCell>
              <TableCell>
                <Badge variant={s.status === "open" ? "default" : "outline"}>{s.status}</Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => askRemove(s)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Season" : "Add Season"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Year</label>
              <Input
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2026/27"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">open</SelectItem>
                  <SelectItem value="closed">closed</SelectItem>
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

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteImpact(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete season {deleteImpact?.year}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>This permanently deletes the season and everything under it:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{deleteImpact?.counts.matchweeks ?? 0} matchweeks</li>
              <li>{deleteImpact?.counts.betweeks ?? 0} betweeks</li>
              <li>{deleteImpact?.counts.schedules ?? 0} fixtures</li>
              <li>{deleteImpact?.counts.picks ?? 0} player picks</li>
            </ul>
            <p className="font-medium text-destructive">This cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteImpact(null); }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
