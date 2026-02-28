"use client";
import { useState } from "react";
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

interface User { id: number; name: string }
interface Matchweek { id: number; week: number }

interface Props {
  users: User[];
  completedMatchweeks: Matchweek[];
  summaryData: Record<number, Record<number, number>>;
  currentUserId: number;
}

export function SummaryClient({ users, completedMatchweeks, summaryData, currentUserId }: Props) {
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);

  const weeklyPoints = summaryData[selectedUserId] ?? {};
  let runningTotal = 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Summary</h1>
        <Select
          value={selectedUserId.toString()}
          onValueChange={(v) => setSelectedUserId(parseInt(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {completedMatchweeks.length === 0 ? (
        <p className="text-muted-foreground">No completed matchweeks yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matchweek</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Running Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {completedMatchweeks.map((mw) => {
              const pts = weeklyPoints[mw.id] ?? 0;
              runningTotal += pts;
              return (
                <TableRow key={mw.id}>
                  <TableCell>Matchweek {mw.week}</TableCell>
                  <TableCell className="text-right">{pts}</TableCell>
                  <TableCell className="text-right font-semibold">{runningTotal}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right">{runningTotal}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
