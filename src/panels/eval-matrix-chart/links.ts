/** Values the cell link can use, as `${name}`. */
export interface LinkContext {
  row: string;
  column: string;
  run_id?: string;
  baseline_row?: string;
  baseline_run_id?: string;
}

const KNOWN_VARIABLES: Record<keyof LinkContext, true> = {
  row: true,
  column: true,
  run_id: true,
  baseline_row: true,
  baseline_run_id: true,
};

/**
 * Replaces `${name}` with the value from `context`, URL-encoded. Unknown names are left as they
 * are, so dashboard variables still reach Perses; a known name without a value becomes empty.
 */
export function interpolate(template: string, context: LinkContext): string {
  return template.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, name) => {
    if (!(name in KNOWN_VARIABLES)) return match;
    const value = context[name as keyof LinkContext];
    if (value === undefined) return "";
    return encodeURIComponent(value);
  });
}

/** Only http(s) and relative URLs; a `javascript:` or `data:` link is dropped. */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!scheme) return true; // relative or protocol-relative
  const name = scheme[1]!.toLowerCase();
  return name === "http" || name === "https";
}

/**
 * The cell link with the cell's values filled in, then the dashboard variables through `resolve`;
 * undefined when there is no template or the result is not a safe URL.
 */
export function resolveCellLink(
  template: string | undefined,
  context: LinkContext,
  resolve: (s: string) => string = (s) => s,
): string | undefined {
  if (!template?.trim()) return undefined;
  const href = resolve(interpolate(template, context));
  return isSafeHref(href) ? href : undefined;
}
