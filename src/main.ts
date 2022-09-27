import { Plugin } from "obsidian";
import { ZodError } from "zod";
import { AnyParams, Route, routes } from "./routes";
import {
  AnyHandlerResult,
  HandlerFailure,
  HandlerFileSuccess,
  HandlerFunction,
  HandlerTextSuccess,
  ProcessingResult,
  StringResultObject,
} from "./types";
import { sendUrlCallback } from "./utils/callbacks";
import { buildFullPath } from "./utils/string-handling";
import {
  focusOrOpenNote,
  logErrorToConsole,
  logToConsole,
  showBrandedNotice,
} from "./utils/ui";

export default class ActionsURI extends Plugin {
  async onload() {
    this.app.workspace.onLayoutReady(() => this.registerRoutes(routes));
  }

  onunload() {
    // Just act natural.
  }

  /**
   * Takes a list of routes and registers them together with their handlers in
   * Obsidian.
   *
   * Each incoming call is first validated against the route's schema; if it
   * passes, its handler is called, then a `x-success`/`x-error` callback is
   * sent out (if necessary) and the processed note is opened in Obsidian (if
   * necessary). If the validation fails, an error message is shown to the
   * user.
   *
   * @param routes - An array of route objects
   */
  private registerRoutes(routes: Route[]) {
    const regdRoutes: string[] = [];

    for (const route of routes) {
      const { path, schema, handler } = route;
      const fullPath = buildFullPath(path);

      this.registerObsidianProtocolHandler(
        fullPath,
        async (incomingParams) => {
          const res = schema.safeParse(incomingParams);
          res.success
            ? await this.handleIncomingCall(handler, <AnyParams> res.data)
            : this.handleParseError(res.error);
        },
      );
      regdRoutes.push(fullPath);
    }

    logToConsole("Registered URI handlers:", regdRoutes);
  }

  /**
   * This function deals with valid incoming calls. It calls the responsible
   * handler and sends out a callback (if necessary) and opens the processed
   * note (if necessary).
   *
   * @param handlerFunc - A route handler function
   * @param params - Parameters from the incoming `x-callback-url` call after
   * being parsed & validated by Zod
   *
   * @returns A `ProcessingResult` object containing the incoming parameters,
   * results from the handler, the callback sending and the note opening
   */
  private async handleIncomingCall(
    handlerFunc: HandlerFunction,
    params: AnyParams,
  ): Promise<ProcessingResult> {
    const handlerResult = await handlerFunc(params);
    const sendCallbackResult = this.sendUrlCallbackIfNeeded(
      handlerResult,
      params,
    );
    const openResult = this.openFileIfNeeded(handlerResult, params);

    const res = <ProcessingResult> {
      params,
      handlerResult,
      sendCallbackResult,
      openResult,
    };
    logToConsole("Call handled:", res);
    return res;
  }

  /**
   * When the parameters of an incoming `x-callback-url` call fail to parse or
   * validate, and thus can't be further processed, we have to inform the user,
   * conveying the error message.
   *
   * @param parseError - The error object returned from Zod's `.safeParse`
   * method
   * @param params - Parameters from the incoming `x-callback-url` call after
   * being parsed & validated by Zod
   */
  private handleParseError(parseError: ZodError) {
    const msg = [
      "Incoming call failed",
      parseError.errors
        .map((error) => `- ${error.path.join(".")}: ${error.message}`),
    ].flat().join("\n");

    showBrandedNotice(msg);
    logErrorToConsole(msg);
  }

  /**
   * Using the passed-in result object the method determines whether we should
   * or even can send a URL callback to the original sender.
   *
   * If the original call contained a non-empty `silent` parameter, we don't
   * send a callback.
   *
   * Otherwise, we trigger callback sending if …
   * - the result object contains a success and a `x-success` parameter
   * - the result object contains a failure and a `x-error` parameter
   *
   * @param handlerRes - A `*Result` object returned by a route handler
   *
   * @see {@link sendUrlCallback}
   */
  private sendUrlCallbackIfNeeded(
    handlerRes: AnyHandlerResult,
    params: AnyParams,
  ): StringResultObject {
    if (handlerRes.isSuccess) {
      return params["x-success"]
        ? sendUrlCallback(
          params["x-success"],
          <HandlerTextSuccess> handlerRes,
          params,
        )
        : <StringResultObject> {
          isSuccess: true,
          result: "No `x-success` callback URL provided",
        };
    }

    return params["x-error"]
      ? sendUrlCallback(
        params["x-error"],
        <HandlerFailure> handlerRes,
        params,
      )
      : <StringResultObject> {
        isSuccess: true,
        result: "No `x-error` callback URL provided",
      };
  }

  private openFileIfNeeded(
    handlerResult: AnyHandlerResult,
    params: AnyParams,
  ): StringResultObject {
    // Do we need to open anything in general?
    if (!handlerResult.isSuccess) {
      return <StringResultObject> {
        isSuccess: true,
        result: "No file to open, the handler failed",
      };
    }

    if ((<any> params).silent) {
      return <StringResultObject> {
        isSuccess: true,
        result: "No file to open, the `silent` parameter was set",
      };
    }

    // Do we have information what to open?
    const { processedFilepath } = (<HandlerFileSuccess> handlerResult);
    if (!processedFilepath) {
      return <StringResultObject> {
        isSuccess: true,
        result:
          "No file to open, handler didn't return a `processedFilepath` property",
      };
    }

    return focusOrOpenNote(processedFilepath);
  }
}
