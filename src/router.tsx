/**
 * Route table per docs/72 § Routing map — Phase 10b core screens.
 * (Dashboard "/", chat, graph, forge, approvals land in Phase 10c;
 * "/" redirects to the projects list until the widget grid exists.)
 */
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import App from "./App";
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
import { EmptyState } from "./components/EmptyState";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: "projects", element: <ProjectsList /> },
      { path: "projects/:name", element: <ProjectOverview /> },
      { path: "projects/:name/configs", element: <ConfigEditorScreen /> },
      { path: "projects/:name/evals", element: <EvalsScreen /> },
      { path: "projects/:name/evals/:evalRunId", element: <EvalDetailScreen /> },
      { path: "projects/:name/versions", element: <VersionsScreen /> },
      { path: "projects/:name/connections", element: <ConnectionsScreen /> },
      { path: "projects/:name/runs", element: <RunsScreen /> },
      { path: "projects/:name/runs/:runId", element: <RunDetailScreen /> },
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
            description="This route does not exist (or lands in Phase 10c)."
          />
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
