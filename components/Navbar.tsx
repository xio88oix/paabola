"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/picks", label: "Picks" },
  { href: "/summary", label: "Summary" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <span className="font-bold text-lg">Paabola</span>
        <div className="flex gap-4 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname.startsWith(link.href)
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname.startsWith("/admin") ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session?.user?.name}</span>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
