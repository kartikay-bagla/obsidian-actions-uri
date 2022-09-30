import { normalize } from "path";
import { STRINGS, URI_NAMESPACE } from "../constants";
import { RegexResultObject } from "../types";

const FRONT_MATTER_BOUNDARY = "---\n";

/**
 * Makes sure the passed-in string ends in a newline.
 *
 * @param str - The string that should end in a newline
 * @returns String ending in a newline
 */
export function ensureNewline(str: string = ""): string {
  return str.endsWith("\n") ? str : `${str}\n`;
}

/**
 * Tries to parse a regular expression stored as a string into an actual, real
 * `RegExp` object.
 *
 * @param search - A string containing a full regular expression, e.g. "/^herp/i"
 *
 * @returns A `RegexResultObject` object containing either an `error` string or
 * a `RegExp` object
 */
export function parseStringIntoRegex(search: string): RegexResultObject {
  if (!search.startsWith("/")) {
    return <RegexResultObject> {
      isSuccess: false,
      error: STRINGS.search_pattern_invalid,
    };
  }

  // Starts to look like a regex, let's try to parse it.
  let re = search.slice(1);
  const lastSlashIdx = re.lastIndexOf("/");

  if (lastSlashIdx === 0) {
    return <RegexResultObject> {
      isSuccess: false,
      error: STRINGS.search_pattern_empty,
    };
  }

  let searchPattern: RegExp;
  let flags = re.slice(lastSlashIdx + 1);
  re = re.slice(0, lastSlashIdx);

  try {
    searchPattern = new RegExp(re, flags);
  } catch (e) {
    return <RegexResultObject> {
      isSuccess: false,
      error: STRINGS.search_pattern_unparseable,
    };
  }

  return <RegexResultObject> {
    isSuccess: true,
    result: searchPattern,
  };
}

/**
 * Tests whether the passed-in string starts with front matter.
 *
 * @param noteContent - The content of the note to be searched
 *
 * @see {@link https://help.obsidian.md/Advanced+topics/YAML+front+matter | Obsidian's YAML front matter documentation}
 */
export function containsFrontMatter(noteContent: string) {
  return noteContent.startsWith(FRONT_MATTER_BOUNDARY) &&
    (noteContent.indexOf(FRONT_MATTER_BOUNDARY, 4) > -1);
}

/**
 * Extracts front matter and body from a passed-in string.
 *
 * @param noteContent - The content of the note to be searched
 *
 * @returns An object containing both `frontMatter` and `body` of the note as
 * keys. When no front matter was found, `frontMatter` will be an empty string
 * while `note` will contain the input string
 *
 * @see {@link https://help.obsidian.md/Advanced+topics/YAML+front+matter | Obsidian's YAML front matter documentation}
 */
export function extractNoteContentParts(
  noteContent: string,
): { frontMatter: string; body: string } {
  const bodyStartPos = noteContent.indexOf(FRONT_MATTER_BOUNDARY, 4) + 4;

  return containsFrontMatter(noteContent)
    ? {
      frontMatter: noteContent.slice(0, bodyStartPos),
      body: noteContent.slice(bodyStartPos),
    }
    : {
      frontMatter: "",
      body: noteContent,
    };
}

/**
 * Removes the YAML boundary lines from a passed-in front matter block.
 *
 * @param frontMatter - A full YAML front matter string, including the boundary lines
 *
 * @returns The YAML front matter string without the boundary lines
 */
export function unwrapFrontMatter(frontMatter: string): string {
  return frontMatter.replace(/^---\n/, "").replace(/---\n$/, "");
}
