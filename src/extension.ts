import { initialize, MidiTrack, AudioTrack, DataModelObject, type Handle, type ActivationContext, type ArrangementSelection } from "@ableton-extensions/sdk";
import webUI from "./interface.html";
import panValues from "./PanValues.js";

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  for (const { label, value } of panValues) {
    const commandId = `setPan_${value}`;

    context.commands.registerCommand(commandId, (...args) => {
      const handle = args[0] as Handle;
      const track = context.getObjectFromHandle(handle, DataModelObject);

      if (track instanceof MidiTrack || track instanceof AudioTrack) {
        track.mixer.panning.setValue(value);
      }
    });

    context.ui.registerContextMenuAction("MidiTrack", label, commandId);
    context.ui.registerContextMenuAction("AudioTrack", label, commandId);
  }

  context.commands.registerCommand("createMidiClipAtSelection", (...args) => {
    const selection = args[0] as ArrangementSelection;
    const url = `data:text/html,${encodeURIComponent(webUI)}`;

    context.ui.showModalDialog(url, 300, 220).then(resultStr => {
      const { bars, looping } = JSON.parse(resultStr) as { bars: number; looping: boolean };
      const startTime = selection.time_selection_start;

      for (const laneHandle of selection.selected_lanes) {
        const track = context.getObjectFromHandle(laneHandle, MidiTrack);
        track.createMidiClip(startTime, bars).then(clip => {
          clip.looping = looping;
        });
      }
    });
  });

  context.ui.registerContextMenuAction("MidiTrack.ArrangementSelection", "Create MIDI Clip...", "createMidiClipAtSelection");
}
