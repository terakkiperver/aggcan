import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { ThemeModeSwitcher } from "@/components/theme-mode-switcher";
import { WorkerLogoutButton } from "@/components/worker-logout-button";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/can_logo.svg"
              alt="CAN Logo"
              width={26}
              height={26}
              className="rounded-sm shadow-md shadow-black/25"
            />
            <span className="font-mono text-sm font-semibold tracking-widest text-primary">
              TESİS TAKİP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <WorkerLogoutButton />
            <ThemeModeSwitcher compact />
            <WorkerClock />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <div data-user-id={session.userId} data-tenant-id={session.tenantId} className="hidden" />
        {children}
      </main>
    </div>
  );
}

function WorkerClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {hh}:{mm}
    </span>
  );
}
