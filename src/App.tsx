/**
 * App shell — sidebar nav, project switcher, theme toggle.
 */
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  ActivityIcon,
  BookOpenIcon,
  BoxesIcon,
  CableIcon,
  ChevronsUpDownIcon,
  DatabaseIcon,
  FileCode2Icon,
  FlaskConicalIcon,
  GitBranchIcon,
  HeartPulseIcon,
  HistoryIcon,
  LayoutGridIcon,
  MoonIcon,
  SettingsIcon,
  StethoscopeIcon,
  SunIcon,
} from "lucide-react";
import { useProjects } from "@/api/hooks/useProjects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

function activeProjectFromPath(pathname: string): string | null {
  const m = /^\/projects\/([^/]+)/.exec(pathname);
  return m?.[1] ?? null;
}

function NavItem({
  to,
  label,
  icon: Icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGridIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive &&
            "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function ProjectSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const active = activeProjectFromPath(location.pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-transparent font-normal"
          aria-label="Switch project"
        >
          <span className="flex min-w-0 items-center gap-2">
            <BoxesIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{active ?? "Select project"}</span>
          </span>
          <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="start">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {(projects ?? []).map((p) => (
          <DropdownMenuItem
            key={p.name}
            onSelect={() => void navigate(`/projects/${p.name}`)}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                p.healthy ? "bg-ok" : "bg-fail",
              )}
              aria-hidden
            />
            {p.name}
          </DropdownMenuItem>
        ))}
        {(projects ?? []).length === 0 && (
          <DropdownMenuItem disabled>No projects found</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

export default function App() {
  const location = useLocation();
  const project = activeProjectFromPath(location.pathname);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-13 items-center justify-between border-b border-sidebar-border px-3 py-2.5">
          <Link
            to="/projects"
            className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGridIcon className="size-3.5" aria-hidden />
            </span>
            Foundry Studio
          </Link>
          <ThemeToggle />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
          <ProjectSwitcher />

          {project && (
            <>
              <SectionLabel>{project}</SectionLabel>
              <div className="space-y-0.5">
                <NavItem to={`/projects/${project}`} label="Overview" icon={BoxesIcon} end />
                <NavItem to={`/projects/${project}/configs`} label="Configs" icon={FileCode2Icon} />
                <NavItem to={`/projects/${project}/evals`} label="Evals" icon={FlaskConicalIcon} />
                <NavItem to={`/projects/${project}/versions`} label="Versions" icon={GitBranchIcon} />
                <NavItem to={`/projects/${project}/connections`} label="Connections" icon={CableIcon} />
                <NavItem to={`/projects/${project}/runs`} label="Runs" icon={HistoryIcon} />
              </div>
            </>
          )}

          <SectionLabel>Workspace</SectionLabel>
          <div className="space-y-0.5">
            <NavItem to="/projects" label="Projects" icon={BoxesIcon} end />
            <NavItem to="/catalog" label="Catalog" icon={BookOpenIcon} />
            <NavItem to="/obs" label="Observability" icon={ActivityIcon} />
            <NavItem to="/doctor" label="Doctor" icon={StethoscopeIcon} />
            <NavItem to="/storage" label="Storage" icon={DatabaseIcon} />
            <NavItem to="/settings" label="Settings" icon={SettingsIcon} />
          </div>
        </nav>

        <div className="border-t border-sidebar-border px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <HeartPulseIcon className="size-3" aria-hidden />
            control plane · localhost
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
