/**
 * Route table per docs/72 § Routing map — complete as of Phase 10c:
 * widget dashboard at "/", per-project chat + flow graph, forge console,
 * cross-project approvals inbox.
 */
import { createBrowserRouter, type RouteObject } from "react-router";
import App from "./App";
import { DashboardScreen } from "./dashboard/DashboardScreen";
import { ProjectsList } from "./features/projects/ProjectsList";
import { ProjectOverview } from "./features/projects/ProjectOverview";
import { ConfigEditorScreen } from "./features/configs/ConfigEditorScreen";
import { CatalogScreen } from "./features/catalog/CatalogScreen";
import { DoctorScreen } from "./features/doctor/DoctorScreen";
import { ObsScreen } from "./features/obs/ObsScreen";
import { RunsScreen } from "./features/runs/RunsScreen";
import { RunDetailScreen } from "./features/runs/RunDetailScreen";
import { EvalsScreen } from "./features/evals/EvalsScreen";
import { EvalDetailScreen } from "./features/evals/EvalDetailScreen";
import { VersionsScreen } from "./features/versions/VersionsScreen";
import { ConnectionsScreen } from "./features/connections/ConnectionsScreen";
import { StorageScreen } from "./features/storage/StorageScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { ChatScreen } from "./features/chat/ChatScreen";
import { GraphScreen } from "./features/graph/GraphScreen";
import { ForgeScreen } from "./features/forge/ForgeScreen";
import { ForgeRunDetail } from "./features/forge/ForgeRunDetail";
import { ApprovalsScreen } from "./features/approvals/ApprovalsScreen";
import { EmptyState } from "./components/EmptyState";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: "projects", element: <ProjectsList /> },
      { path: "projects/:name", element: <ProjectOverview /> },
      { path: "projects/:name/configs", element: <ConfigEditorScreen /> },
      { path: "projects/:name/chat", element: <ChatScreen /> },
      { path: "projects/:name/graph", element: <GraphScreen /> },
      { path: "projects/:name/evals", element: <EvalsScreen /> },
      { path: "projects/:name/evals/:evalRunId", element: <EvalDetailScreen /> },
      { path: "projects/:name/versions", element: <VersionsScreen /> },
      { path: "projects/:name/connections", element: <ConnectionsScreen /> },
      { path: "projects/:name/runs", element: <RunsScreen /> },
      { path: "projects/:name/runs/:runId", element: <RunDetailScreen /> },
      { path: "forge", element: <ForgeScreen /> },
      { path: "forge/:forgeRunId", element: <ForgeRunDetail /> },
      { path: "approvals", element: <ApprovalsScreen /> },
      { path: "catalog", element: <CatalogScreen /> },
      { path: "obs", element: <ObsScreen /> },
      { path: "doctor", element: <DoctorScreen /> },
      { path: "storage", element: <StorageScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      {
        path: "*",
        element: (
          <EmptyState
            title="Page not found"
            description="This route does not exist."
          />
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
