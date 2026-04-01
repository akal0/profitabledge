"use client";

import {
  DEFAULT_MODEL_COLORS,
  DEFAULT_SESSION_COLORS,
} from "./bulk-actions-constants";

export type BulkActionsState = {
  appendNote: boolean;
  deleteDialogOpen: boolean;
  mode:
    | "idle"
    | "delete"
    | "notes"
    | "stats"
    | "sessionTag"
    | "modelTag"
    | "shareCard"
    | "replay";
  modelTagColor: string;
  modelTagName: string;
  noteText: string;
  notesDialogOpen: boolean;
  replayOpen: boolean;
  sessionTagColor: string;
  sessionTagName: string;
  shareCardOpen: boolean;
  showModelColorPicker: boolean;
  showSessionColorPicker: boolean;
  statsOpen: boolean;
};

export type BulkActionsAction =
  | { type: "setMode"; mode: BulkActionsState["mode"] }
  | { type: "setDeleteDialogOpen"; open: boolean }
  | { type: "setNotesDialogOpen"; open: boolean }
  | { type: "setStatsOpen"; open: boolean }
  | { type: "setShareCardOpen"; open: boolean }
  | { type: "setReplayOpen"; open: boolean }
  | { type: "setSessionTagName"; value: string }
  | { type: "setSessionTagColor"; value: string }
  | { type: "setShowSessionColorPicker"; open: boolean }
  | { type: "setModelTagName"; value: string }
  | { type: "setModelTagColor"; value: string }
  | { type: "setShowModelColorPicker"; open: boolean }
  | { type: "setNoteText"; value: string }
  | { type: "setAppendNote"; value: boolean }
  | { type: "resetSessionTag" }
  | { type: "resetModelTag" }
  | { type: "resetNotes" };

export function createInitialBulkActionsState(): BulkActionsState {
  return {
    appendNote: false,
    deleteDialogOpen: false,
    mode: "idle",
    modelTagColor: DEFAULT_MODEL_COLORS[0],
    modelTagName: "",
    noteText: "",
    notesDialogOpen: false,
    replayOpen: false,
    sessionTagColor: DEFAULT_SESSION_COLORS[0],
    sessionTagName: "",
    shareCardOpen: false,
    showModelColorPicker: false,
    showSessionColorPicker: false,
    statsOpen: false,
  };
}

export function bulkActionsReducer(
  state: BulkActionsState,
  action: BulkActionsAction
): BulkActionsState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode };
    case "setDeleteDialogOpen":
      return {
        ...state,
        deleteDialogOpen: action.open,
        mode: action.open ? "delete" : state.mode === "delete" ? "idle" : state.mode,
      };
    case "setNotesDialogOpen":
      return {
        ...state,
        notesDialogOpen: action.open,
        mode: action.open ? "notes" : state.mode === "notes" ? "idle" : state.mode,
      };
    case "setStatsOpen":
      return {
        ...state,
        statsOpen: action.open,
        mode: action.open ? "stats" : state.mode === "stats" ? "idle" : state.mode,
      };
    case "setShareCardOpen":
      return {
        ...state,
        shareCardOpen: action.open,
        mode: action.open ? "shareCard" : state.mode === "shareCard" ? "idle" : state.mode,
      };
    case "setReplayOpen":
      return {
        ...state,
        replayOpen: action.open,
        mode: action.open ? "replay" : state.mode === "replay" ? "idle" : state.mode,
      };
    case "setSessionTagName":
      return { ...state, mode: "sessionTag", sessionTagName: action.value };
    case "setSessionTagColor":
      return { ...state, mode: "sessionTag", sessionTagColor: action.value };
    case "setShowSessionColorPicker":
      return {
        ...state,
        mode: "sessionTag",
        showSessionColorPicker: action.open,
      };
    case "setModelTagName":
      return { ...state, mode: "modelTag", modelTagName: action.value };
    case "setModelTagColor":
      return { ...state, mode: "modelTag", modelTagColor: action.value };
    case "setShowModelColorPicker":
      return {
        ...state,
        mode: "modelTag",
        showModelColorPicker: action.open,
      };
    case "setNoteText":
      return { ...state, mode: "notes", noteText: action.value };
    case "setAppendNote":
      return { ...state, mode: "notes", appendNote: action.value };
    case "resetSessionTag":
      return {
        ...state,
        mode: state.mode === "sessionTag" ? "idle" : state.mode,
        sessionTagName: "",
        sessionTagColor: DEFAULT_SESSION_COLORS[0],
        showSessionColorPicker: false,
      };
    case "resetModelTag":
      return {
        ...state,
        mode: state.mode === "modelTag" ? "idle" : state.mode,
        modelTagName: "",
        modelTagColor: DEFAULT_MODEL_COLORS[0],
        showModelColorPicker: false,
      };
    case "resetNotes":
      return {
        ...state,
        appendNote: false,
        mode: state.mode === "notes" ? "idle" : state.mode,
        noteText: "",
        notesDialogOpen: false,
      };
    default:
      return state;
  }
}
