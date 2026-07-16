/**
 * Settings — theme, auth token (bearer for /api/*), studio health readout.
 * Layout reset arrives with widget dashboards in 10c.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRoundIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { toast } from "sonner";
import { apiGet, getAuthToken, setAuthToken } from "@/api/client";
import type { StudioHealth } from "@/api/types";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/theme/ThemeProvider";
import { formatDuration } from "@/lib/format";

export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [token, setToken] = useState(getAuthToken() ?? "");
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<StudioHealth>("/api/health"),
    refetchInterval: 30_000,
  });

  const saveToken = () => {
    setAuthToken(token.trim() || null);
    toast.success(token.trim() ? "Token saved" : "Token cleared");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Theme, auth, and studio status." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorIcon className="size-4 text-muted-foreground" aria-hidden />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <SunIcon aria-hidden /> Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <MoonIcon aria-hidden /> Dark
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-muted-foreground" aria-hidden />
              API token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="auth-token">
              Bearer token (only needed when the studio binds non-loopback)
            </Label>
            <div className="flex gap-2">
              <Input
                id="auth-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="FOUNDRY_STUDIO_TOKEN value"
              />
              <Button onClick={saveToken}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Studio health</CardTitle>
          </CardHeader>
          <CardContent>
            {health.data ? (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="ok">status: {health.data.status}</Badge>
                <Badge variant="secondary">v{health.data.version}</Badge>
                <Badge variant="muted">
                  uptime {formatDuration(health.data.uptime_s * 1000)}
                </Badge>
                <Badge variant="muted">
                  {health.data.active_forge_runs} forge · {" "}
                  {health.data.active_chat_sessions} chat · pool{" "}
                  {health.data.run_manager_pool}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {health.isLoading ? "Checking…" : "Control plane unreachable."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
