/**
 * Route-level code splitting: the heavy screens (CodeMirror editors,
 * the xyflow/dagre flow graph, recharts dashboards, the grid-layout
 * dashboard host, the forge console) load lazily so the initial bundle
 * stays lean. The Suspense boundary lives in App around the <Outlet />.
 */
import { lazy } from "react";

export const DashboardScreen = lazy(() =>
  import("./dashboard/DashboardScreen").then((m) => ({
    default: m.DashboardScreen,
  })),
);
export const ConfigEditorScreen = lazy(() =>
  import("./features/configs/ConfigEditorScreen").then((m) => ({
    default: m.ConfigEditorScreen,
  })),
);
export const CatalogScreen = lazy(() =>
  import("./features/catalog/CatalogScreen").then((m) => ({
    default: m.CatalogScreen,
  })),
);
export const ObsScreen = lazy(() =>
  import("./features/obs/ObsScreen").then((m) => ({ default: m.ObsScreen })),
);
export const EvalsScreen = lazy(() =>
  import("./features/evals/EvalsScreen").then((m) => ({
    default: m.EvalsScreen,
  })),
);
export const EvalDetailScreen = lazy(() =>
  import("./features/evals/EvalDetailScreen").then((m) => ({
    default: m.EvalDetailScreen,
  })),
);
export const VersionsScreen = lazy(() =>
  import("./features/versions/VersionsScreen").then((m) => ({
    default: m.VersionsScreen,
  })),
);
export const GraphScreen = lazy(() =>
  import("./features/graph/GraphScreen").then((m) => ({
    default: m.GraphScreen,
  })),
);
export const ForgeScreen = lazy(() =>
  import("./features/forge/ForgeScreen").then((m) => ({
    default: m.ForgeScreen,
  })),
);
export const ForgeRunDetail = lazy(() =>
  import("./features/forge/ForgeRunDetail").then((m) => ({
    default: m.ForgeRunDetail,
  })),
);
