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
import { Badge } from "@/components/ui/badge";

interface User { id: number; name: string; isAdmin: boolean; trmnlToken?: string | null }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [tokenUser, setTokenUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", password: "", isAdmin: false });

  async function load() {
    const res = await fetch("/api/admin/users");
    setUsers(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", password: "", isAdmin: false });
    setOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, password: "", isAdmin: u.isAdmin });
    setOpen(true);
  }

  async function save() {
    if (editing) {
      await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
    } else {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this user?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  function trmnlUrl(token: string | null | undefined): string {
    if (!token) return "";
    return `${window.location.origin}/api/trmnl/results?token=${token}`;
  }

  async function regenerateToken(u: User) {
    const res = await fetch("/api/admin/users/trmnl-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    const data = await res.json();
    setTokenUser({ ...u, trmnlToken: data.trmnlToken });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={openCreate}>Add User</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>
                <Badge variant={u.isAdmin ? "default" : "secondary"}>
                  {u.isAdmin ? "Admin" : "Player"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => setTokenUser(u)}>TRMNL</Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(u.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Username</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Password {editing && "(leave blank to keep)"}</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? "New password" : "Required"}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAdmin"
                checked={form.isAdmin}
                onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              />
              <label htmlFor="isAdmin" className="text-sm font-medium">Admin</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tokenUser} onOpenChange={(o) => !o && setTokenUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TRMNL device URL — {tokenUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {tokenUser?.trmnlToken ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Paste this as the Polling URL in the TRMNL private plugin:
                </p>
                <Input
                  readOnly
                  value={trmnlUrl(tokenUser.trmnlToken)}
                  onFocus={(e) => e.target.select()}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No token yet. Generate one to get a polling URL.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenUser(null)}>Close</Button>
            <Button onClick={() => tokenUser && regenerateToken(tokenUser)}>
              {tokenUser?.trmnlToken ? "Regenerate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
