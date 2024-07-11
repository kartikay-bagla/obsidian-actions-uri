import { parseFrontMatterEntry } from "obsidian";
import { z } from "zod";
import { STRINGS } from "../constants";
import { obsEnv } from "./obsidian-env";
import { getPeriodNotePathIfPluginIsAvailable } from "./periodic-notes-handling";
import { failure, success } from "./results-handling";
import { NoteTargetingComputedValues, NoteTargetingParams } from "../schemata";
import { StringResultObject } from "../types";
import { zodExistingNotePath } from "./zod";

/**
 * Validates the targeting parameters of a note and adds computed values.
 *
 * This function ensures that exactly one of the specified targeting parameters
 * (`file`, `uid`, or `periodic-note`) is provided. If the validation passes,
 * it gets the requested note path based on the input and appends it to the
 * returned object.
 *
 * @param data - The input data containing targeting parameters.
 * @param ctx - The Zod refinement context used for adding validation issues.
 * @returns The input object augmented with computed values if validation
 *    succeeds; otherwise, it triggers a Zod validation error.
 * @throws {ZodError} If more than one or none of the targeting parameters are
 *    provided.
 *
 * @template T - The type of the input data.
 */
export function softValidateNoteTargetingAndResolvePath<T>(
  data: T,
  ctx: z.RefinementCtx,
): T & NoteTargetingComputedValues {
  return validateNoteTargetingAndResolvePath(data, ctx, false);
}

/**
 * Validates the targeting parameters of a note and adds computed values.
 * Triggers a Zod validation error if the requested note path does not exist.
 *
 * This function ensures that exactly one of the specified targeting parameters
 * (`file`, `uid`, or `periodic-note`) is provided. If the validation passes,
 * it gets the requested note path based on the input and appends it to the
 * returned object.
 *
 * @param data - The input data containing targeting parameters.
 * @param ctx - The Zod refinement context used for adding validation issues.
 * @returns The input object augmented with computed values if validation
 *    succeeds; otherwise, it triggers a Zod validation error. Also triggers a
 *    Zod validation error if the note path does not exist.
 * @throws {ZodError} If more than one or none of the targeting parameters are
 *    provided.
 *
 * @template T - The type of the input data.
 */
export function hardValidateNoteTargetingAndResolvePath<T>(
  data: T,
  ctx: z.RefinementCtx,
): T & NoteTargetingComputedValues {
  return validateNoteTargetingAndResolvePath(data, ctx, true);
}

// -----------------------------------------------------------------------------

/**
 * Validates the targeting parameters of a note and adds computed values.
 *
 * This function ensures that exactly one of the specified targeting parameters
 *  (`file`, `uid`, or `periodic-note`) is provided. If the validation passes,
 * it gets the requested note path based on the input and appends it to the
 * returned object.
 *
 * @param data - The input data containing targeting parameters.
 * @param ctx - The Zod refinement context used for adding validation issues.
 * @returns The input object augmented with computed values if validation
 * succeeds; otherwise, it triggers a Zod validation error.
 * @throws {ZodError} If more than one or none of the targeting parameters are provided.
 *
 * @template T - The type of the input data.
 */
function validateNoteTargetingAndResolvePath<T>(
  data: T,
  ctx: z.RefinementCtx,
  throwOnMissingNote: boolean,
): T & NoteTargetingComputedValues {
  const input = data as NoteTargetingParams;

  // Validate that only one of the three keys is present
  const keysCount = ["file", "uid", "periodic-note"]
    .filter((key) => key in input)
    .length;

  if (keysCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: STRINGS.faulty_note_targeting,
    });
    return z.NEVER;
  }

  // Get the requested file path
  let inputKey = "";
  let path = "";
  if (input.file) {
    inputKey = "file";
    path = input.file;
  } else if (input.uid) {
    inputKey = "uid";
    const res = filepathForUID(input.uid);
    path = res.isSuccess ? res.result : "";
  } else if (input["periodic-note"]) {
    inputKey = "periodic-note";
    const res = getPeriodNotePathIfPluginIsAvailable(input["periodic-note"]);
    path = res.isSuccess ? res.result : "";
  }

  const pathExists = path != "" && zodExistingNotePath.safeParse(path).success;
  if (!pathExists && throwOnMissingNote) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: STRINGS.note_not_found,
    });
    return z.NEVER;
  }

  // Return original object plus computed values
  return {
    ...data,
    _computed: {
      inputKey,
      path,
      pathExists,
    },
  };
}

function filepathForUID(uid: string): StringResultObject {
  const path = findPathForUIDInMetadataCache(uid) ||
    findPathForUIDInMarkdownFiles(uid);

  return path ? success(path) : failure(404, STRINGS.note_not_found);
}

function findPathForUIDInMetadataCache(uid: string): string | undefined {
  // TODO: Make frontmatter key configurable
  const uidKey = "uid";

  const hash = Object.entries(obsEnv.app.metadataCache.metadataCache)
    .find(([_, cached]) =>
      cached.frontmatter?.[uidKey] &&
      [cached.frontmatter[uidKey]].flat().map((u) => `${u}`).includes(uid)
    )
    ?.[0];

  const filePath = Object.entries(obsEnv.app.metadataCache.fileCache)
    .find(([_, cache]) => cache.hash === hash)
    ?.[0];

  return filePath;
}

function findPathForUIDInMarkdownFiles(uid: string): string | undefined {
  // TODO: Make frontmatter key configurable
  const uidKey = "uid";

  return obsEnv.app.vault
    .getMarkdownFiles()
    .find((note) => {
      let uidValues = parseFrontMatterEntry(
        obsEnv.app.metadataCache.getFileCache(note)?.frontmatter,
        uidKey,
      );
      return [uidValues].flatMap((u) => `${u}`).includes(uid);
    })
    ?.path;
}
