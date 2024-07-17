import { moment, TFile } from "obsidian";
import {
  appHasDailyNotesPluginLoaded,
  appHasMonthlyNotesPluginLoaded,
  appHasQuarterlyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  appHasYearlyNotesPluginLoaded,
  createDailyNote,
  createMonthlyNote,
  createQuarterlyNote,
  createWeeklyNote,
  createYearlyNote,
  getAllDailyNotes,
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllWeeklyNotes,
  getAllYearlyNotes,
  getDailyNote,
  getDailyNoteSettings,
  getMonthlyNote,
  getMonthlyNoteSettings,
  getQuarterlyNote,
  getQuarterlyNoteSettings,
  getWeeklyNote,
  getWeeklyNoteSettings,
  getYearlyNote,
  getYearlyNoteSettings,
} from "obsidian-daily-notes-interface";
import { STRINGS } from "src/constants";
import { StringResultObject, TFileResultObject } from "src/types";
import { getNote, sanitizeFilePath } from "src/utils/file-handling";
import { ErrorCode, failure, success } from "src/utils/results-handling";

export enum PeriodicNoteType {
  DailyNote = "daily",
  WeeklyNote = "weekly",
  MonthlyNote = "monthly",
  QuarterlyNote = "quarterly",
  YearlyNote = "yearly",
}

export async function createPeriodNote(
  periodicNoteType: PeriodicNoteType,
): Promise<TFile> {
  const now = moment();
  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      return createDailyNote(now);

    case PeriodicNoteType.WeeklyNote:
      return createWeeklyNote(now);

    case PeriodicNoteType.MonthlyNote:
      return createMonthlyNote(now);

    case PeriodicNoteType.QuarterlyNote:
      return createQuarterlyNote(now);

    case PeriodicNoteType.YearlyNote:
      return createYearlyNote(now);
  }
}

export function periodicNoteFilePath(
  periodicNoteType: PeriodicNoteType,
  date: moment.Moment,
): string {
  let getSettingsFn: Function;
  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      getSettingsFn = getDailyNoteSettings;
      break;

    case PeriodicNoteType.WeeklyNote:
      getSettingsFn = getWeeklyNoteSettings;
      break;

    case PeriodicNoteType.MonthlyNote:
      getSettingsFn = getMonthlyNoteSettings;
      break;

    case PeriodicNoteType.QuarterlyNote:
      getSettingsFn = getQuarterlyNoteSettings;
      break;

    case PeriodicNoteType.YearlyNote:
      getSettingsFn = getYearlyNoteSettings;
      break;
  }

  const { format, folder } = getSettingsFn();
  const filename = date.format(format);
  return sanitizeFilePath(`${folder}/${filename}.md`);
}

/**
 * Checks if the daily/weekly/monthly/etc periodic note feature is available,
 * and gets the path to the current related note.
 *
 * @returns Successful `StringResultObject` containing the path if the PN
 * functionality is available and there is a current daily note. Unsuccessful
 * `StringResultObject` if it isn't.
 */
export function getExistingPeriodNotePathIfPluginIsAvailable(
  periodicNoteType: PeriodicNoteType,
): StringResultObject {
  let pluginLoadedCheck: () => boolean;
  let getCurrentPeriodNote: () => TFile;
  const now = moment();

  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      pluginLoadedCheck = appHasDailyNotesPluginLoaded;
      getCurrentPeriodNote = () => getDailyNote(now, getAllDailyNotes());
      break;

    case PeriodicNoteType.WeeklyNote:
      pluginLoadedCheck = appHasWeeklyNotesPluginLoaded;
      getCurrentPeriodNote = () => getWeeklyNote(now, getAllWeeklyNotes());
      break;

    case PeriodicNoteType.MonthlyNote:
      pluginLoadedCheck = appHasMonthlyNotesPluginLoaded;
      getCurrentPeriodNote = () => getMonthlyNote(now, getAllMonthlyNotes());
      break;

    case PeriodicNoteType.QuarterlyNote:
      pluginLoadedCheck = appHasQuarterlyNotesPluginLoaded;
      getCurrentPeriodNote = () =>
        getQuarterlyNote(now, getAllQuarterlyNotes());
      break;

    case PeriodicNoteType.YearlyNote:
      pluginLoadedCheck = appHasYearlyNotesPluginLoaded;
      getCurrentPeriodNote = () => getYearlyNote(now, getAllYearlyNotes());
      break;
  }

  if (!pluginLoadedCheck()) {
    return failure(
      ErrorCode.FeatureUnavailable,
      STRINGS[`${periodicNoteType}_note`].feature_not_available,
    );
  }

  const pNote = getCurrentPeriodNote();
  return pNote
    ? success(pNote.path)
    : failure(ErrorCode.NotFound, STRINGS.note_not_found);
}

export function getCurrentPeriodNote(
  periodicNoteType: PeriodicNoteType,
): TFile | undefined {
  const now = moment();

  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      return getDailyNote(now, getAllDailyNotes());

    case PeriodicNoteType.WeeklyNote:
      return getWeeklyNote(now, getAllWeeklyNotes());

    case PeriodicNoteType.MonthlyNote:
      return getMonthlyNote(now, getAllMonthlyNotes());

    case PeriodicNoteType.QuarterlyNote:
      return getQuarterlyNote(now, getAllQuarterlyNotes());

    case PeriodicNoteType.YearlyNote:
      return getYearlyNote(now, getAllYearlyNotes());
  }
}

export async function getMostRecentPeriodNote(
  periodicNoteType: PeriodicNoteType,
): Promise<TFileResultObject> {
  if (!appHasPeriodPluginLoaded(periodicNoteType)) {
    return failure(
      ErrorCode.FeatureUnavailable,
      STRINGS[`${periodicNoteType}_note`].feature_not_available,
    );
  }

  const notes = getAllPeriodNotes(periodicNoteType);
  const mostRecentKey = Object.keys(notes).sort().last();
  if (!mostRecentKey) {
    return failure(404, STRINGS.note_not_found);
  }

  const pNote = notes[mostRecentKey];
  return await getNote(pNote.path);
}

export function getAllPeriodNotes(
  periodicNoteType: PeriodicNoteType,
): Record<string, TFile> {
  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      return getAllDailyNotes();

    case PeriodicNoteType.WeeklyNote:
      return getAllWeeklyNotes();

    case PeriodicNoteType.MonthlyNote:
      return getAllMonthlyNotes();

    case PeriodicNoteType.QuarterlyNote:
      return getAllQuarterlyNotes();

    case PeriodicNoteType.YearlyNote:
      return getAllYearlyNotes();
  }
}

export function appHasPeriodPluginLoaded(
  periodicNoteType: PeriodicNoteType,
): boolean {
  switch (periodicNoteType) {
    case PeriodicNoteType.DailyNote:
      return appHasDailyNotesPluginLoaded();

    case PeriodicNoteType.WeeklyNote:
      return appHasWeeklyNotesPluginLoaded();

    case PeriodicNoteType.MonthlyNote:
      return appHasMonthlyNotesPluginLoaded();

    case PeriodicNoteType.QuarterlyNote:
      return appHasQuarterlyNotesPluginLoaded();

    case PeriodicNoteType.YearlyNote:
      return appHasYearlyNotesPluginLoaded();
  }
}
