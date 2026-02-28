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

interface Team { id: number; club: string }

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [club, setClub] = useState("");

  async function load() {
    const res = await fetch("/api/admin/teams");
    setTeams(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setClub("");
    setOpen(true);
  }

  function openEdit(t: Team) {
    setEditing(t);
    setClub(t.club);
    setOpen(true);
  }

  async function save() {
    if (editing) {
      await fetch("/api/admin/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, club }),
      });
    } else {
      await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ club }),
      });
    }
    setOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this team?")) return;
    await fetch("/api/admin/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Button onClick={openCreate}>Add Team</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.club}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(t.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Team" : "Add Team"}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Club Name</label>
            <Input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Arsenal" />
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
