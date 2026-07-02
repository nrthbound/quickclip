import { initialize, MidiTrack, AudioTrack, DataModelObject, type Handle, type ActivationContext, type ArrangementSelection } from "@ableton-extensions/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import panValues from "./PanValues.js";
import clipLengthOptions from "./ClipOptions.js";
import modalInterface from "./interface.html";
import { buildThemeCssVariables } from "./WebViewTheme.js";

const COMMAND_PREFIX = "quickclip";
const SETTINGS_FILE = "quickclip-settings.json";

type ClipDialogSettings = {
  beats: number;
  looping: boolean;
};

const DEFAULT_CLIP_DIALOG_SETTINGS: ClipDialogSettings = {
  beats: 16,
  looping: false,
};

const validBeats = new Set(clipLengthOptions.map((option) => option.value));

function normalizeBeats(value: unknown): number {
  return typeof value === "number" && validBeats.has(value)
    ? value
    : DEFAULT_CLIP_DIALOG_SETTINGS.beats;
}

function normalizeLooping(value: unknown): boolean {
  return value === true;
}

function parseClipDialogSettings(raw: string): ClipDialogSettings {
  const parsed = JSON.parse(raw) as { beats?: unknown; looping?: unknown };

  return {
    beats: normalizeBeats(parsed.beats),
    looping: normalizeLooping(parsed.looping),
  };
}

async function loadClipDialogSettings(storageDirectory: string | undefined): Promise<ClipDialogSettings> {
  if (!storageDirectory) {
    return DEFAULT_CLIP_DIALOG_SETTINGS;
  }

  try {
    const settingsPath = path.join(storageDirectory, SETTINGS_FILE);
    const content = await readFile(settingsPath, "utf8");
    return parseClipDialogSettings(content);
  } catch {
    return DEFAULT_CLIP_DIALOG_SETTINGS;
  }
}

async function saveClipDialogSettings(storageDirectory: string | undefined, settings: ClipDialogSettings): Promise<void> {
  if (!storageDirectory) {
    return;
  }

  try {
    await mkdir(storageDirectory, { recursive: true });
    const settingsPath = path.join(storageDirectory, SETTINGS_FILE);
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  } catch {
    console.warn("[QuickClip] Failed to persist clip dialog settings.");
  }
}

function buildClipDialogHtml(settings: ClipDialogSettings): string {
  return modalInterface
    .replace("__QC_THEME_STYLE__", buildThemeCssVariables())
    .replace("__QC_INITIAL_SETTINGS__", JSON.stringify(settings));
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");
  console.log("[QuickClip] activate()");

  panValues.forEach(({ label, value }, index) => {
    const commandId = `${COMMAND_PREFIX}.set-pan-${index}`;

    context.commands.registerCommand(commandId, (...args) => {
      const handle = args[0] as Handle;
      const track = context.getObjectFromHandle(handle, DataModelObject);

      if (track instanceof MidiTrack || track instanceof AudioTrack) {
        track.mixer.panning.setValue(value);
      }
    });

    void context.ui.registerContextMenuAction("MidiTrack", label, commandId);
    void context.ui.registerContextMenuAction("AudioTrack", label, commandId);
  });

  clipLengthOptions.forEach(({ label, value }, index) => {
    const commandId = `${COMMAND_PREFIX}.create-midi-clip-${index}`;

    context.commands.registerCommand(commandId, (...args) => {
      const selection = args[0] as ArrangementSelection;
      const startTime = selection.time_selection_start;

      for (const laneHandle of selection.selected_lanes) {
        const track = context.getObjectFromHandle(laneHandle, MidiTrack);
        track.createMidiClip(startTime, value).then(clip => {
          clip.looping = false;
        });
      }
    });

    void context.ui.registerContextMenuAction("MidiTrack.ArrangementSelection", label, commandId);
  });

  const openClipDialogCommandId = `${COMMAND_PREFIX}.open-clip-dialog`;

  context.commands.registerCommand(openClipDialogCommandId, async (...args) => {
    const selection = args[0] as ArrangementSelection;
    const startTime = selection.time_selection_start;

    const initialSettings = await loadClipDialogSettings(context.environment.storageDirectory);
    const modalHtml = buildClipDialogHtml(initialSettings);

    const result = await context.ui.showModalDialog(
      `data:text/html,${encodeURIComponent(modalHtml)}`,
      980,
      520,
    );

    const parsed = JSON.parse(result) as { beats?: unknown; looping?: unknown; cancelled?: unknown };
    if (parsed.cancelled === true) {
      return;
    }

    const settings: ClipDialogSettings = {
      beats: normalizeBeats(parsed.beats),
      looping: normalizeLooping(parsed.looping),
    };

    await saveClipDialogSettings(context.environment.storageDirectory, settings);

    for (const laneHandle of selection.selected_lanes) {
      const track = context.getObjectFromHandle(laneHandle, MidiTrack);
      track.createMidiClip(startTime, settings.beats).then((clip) => {
        clip.looping = settings.looping;
      });
    }
  });

  void context.ui.registerContextMenuAction(
    "MidiTrack.ArrangementSelection",
    "Create MIDI Clip...",
    openClipDialogCommandId,
  );

}
