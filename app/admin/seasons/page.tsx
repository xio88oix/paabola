"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Season { id: number; year: number }

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [year, setYear] = useState("");

  async function load() {
    const res = await fetch("/api/admin/seasons");
    setSeasons(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setYear("");
    setOpen(true);
  }

  function openEdit(s: Season) {
    setEditing(s);
    setYear(String(s.year));
    setOpen(true);
  }

  async function save() {
    if (editing) {
      await fetch("/api/admin/seasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, year: parseInt(year) }),
      });
    } else {
      await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(year) }),
      });
    }
    setOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this season?")) return;
    await fetch("/api/admin/seasons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seasons.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.year}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(s.id)}>Delete</Button>
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
          <div>
            <label className="text-sm font-medium">Year</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
            />
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
