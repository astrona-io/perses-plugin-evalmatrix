import { PanelPlugin } from "@perses-dev/plugin-system";
import { EvalMatrixChartComponent } from "./EvalMatrixChartComponent";
import {
  EvalMatrixChartOptions,
  EvalMatrixChartProps,
  createInitialEvalMatrixChartOptions,
} from "./eval-matrix-chart-types";
import { EvalMatrixChartSettingsEditor } from "./EvalMatrixChartSettingsEditor";

/**
 * A rows × columns matrix where every cell shows a value and how it moved against a baseline row
 * or the previous run, with the good direction known per column.
 */
export const EvalMatrixChart: PanelPlugin<
  EvalMatrixChartOptions,
  EvalMatrixChartProps
> = {
  PanelComponent: EvalMatrixChartComponent,
  panelOptionsEditorComponents: [
    { label: "Settings", content: EvalMatrixChartSettingsEditor },
  ],
  supportedQueryTypes: ["TimeSeriesQuery"],
  createInitialOptions: createInitialEvalMatrixChartOptions,
};
