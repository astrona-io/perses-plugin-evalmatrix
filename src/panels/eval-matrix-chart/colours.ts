import { alpha, Theme } from "@mui/material";
import { Delta } from "./delta";

export type Tone =
  "baseline" | "better" | "same" | "worseSmall" | "worseLarge" | "plain";

export interface ToneColours {
  /** Text colour of the delta line. */
  fg: string;
  /** Cell background. */
  bg: string;
}

/** Theme colours resolved once per theme, so rows get plain strings and stay memoisable. */
export type Colours = Record<Tone, ToneColours> & { selected: string };

export function resolveColours(theme: Theme): Colours {
  const dark = theme.palette.mode === "dark";
  const tint = (colour: string, light: number): string =>
    alpha(colour, dark ? light + 0.06 : light);
  return {
    baseline: {
      fg: theme.palette.text.secondary,
      bg: tint(theme.palette.text.primary, 0.06),
    },
    better: {
      fg: theme.palette.success.main,
      bg: tint(theme.palette.success.main, 0.12),
    },
    same: { fg: theme.palette.text.secondary, bg: "transparent" },
    worseSmall: {
      fg: dark ? theme.palette.warning.light : theme.palette.warning.dark,
      bg: tint(theme.palette.warning.main, 0.14),
    },
    worseLarge: {
      fg: theme.palette.error.main,
      bg: tint(theme.palette.error.main, 0.16),
    },
    plain: { fg: theme.palette.text.secondary, bg: "transparent" },
    selected: theme.palette.text.primary,
  };
}

/** The colour of a cell: the baseline row is neutral, the rest follow their delta. */
export function toneOf(isBaseline: boolean, delta?: Delta): Tone {
  if (isBaseline) return "baseline";
  if (!delta) return "plain";
  if (delta.status === "better") return "better";
  if (delta.status === "same") return "same";
  return delta.size === "large" ? "worseLarge" : "worseSmall";
}
