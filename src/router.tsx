/**
 * Route table per docs/72 § Routing map — complete as of Phase 10c:
 * widget dashboard at "/", per-project chat + flow graph, forge console,
 * cross-project approvals inbox.
 *
 * Heavy screens come from ./lazy-screens (route-level code splitting);
 * light screens stay eager.
 */
import { createBrowserRouter, type RouteObject } from "react-router";
import App from "./App";
import { ProjectsList } from "./features/projects/ProjectsList";
import { ProjectOverview } from "./features/projects/ProjectOverview";
import { DoctorScreen } from "./features/doctor/DoctorScreen";
import { RunsScreen } from "./features/runs/RunsScreen";
import { RunDetailScreen } from "./features/runs/RunDetailScreen";
import { ConnectionsScreen } from "./features/connections/ConnectionsScreen";
import { StorageScreen } from "./features/storage/StorageScreen";
import { ProvidersScreen } from "./features/providers/ProvidersScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { ChatScreen } from "./features/chat/ChatScreen";
import { ApprovalsScreen } from "./features/approvals/ApprovalsScreen";
import { EmptyState } from "./components/EmptyState";
import {
  CatalogScreen,
  ConfigEditorScreen,
  DashboardScreen,
  EvalDetailScreen,
  EvalsScreen,
  ForgeRunDetail,
  ForgeScreen,
  GraphScreen,
  ObsScreen,
  VersionsScreen,
} from "./lazy-screens";

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
      { path: "providers", element: <ProvidersScreen /> },
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
