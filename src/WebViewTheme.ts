export const extensionUiTheme = {
  name: "Midnight Lime",
  background: "#09080F",
  panel: "#09080F",
  panelSoft: "#1D1C21",
  border: "#4A4951",
  text: "#F3F3F6",
  muted: "#C8C8CF",
  input: "#1D1C21",
  accent: "#FBFD82",
  buttonText: "#14130F",
} as const;

export function buildThemeCssVariables(): string {
  const t = extensionUiTheme;
  return [
    `--bg: ${t.background};`,
    `--panel: ${t.panel};`,
    `--panel-soft: ${t.panelSoft};`,
    `--border: ${t.border};`,
    `--text: ${t.text};`,
    `--muted: ${t.muted};`,
    `--input: ${t.input};`,
    `--accent: ${t.accent};`,
    `--button-text: ${t.buttonText};`,
  ].join("\n      ");
}
