import Link from "next/link";
import { Navbar } from "@/components/Navbar";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/matchweeks", label: "Matchweeks" },
  { href: "/admin/schedule", label: "Schedule" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside className="w-48 shrink-0">
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
