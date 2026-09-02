/**
 * Local additions to the webmcp-types package.
 *
 * 1. Chromium ships an executeTool() extension that the published types do not
 *    yet cover. It is used by the built-in agent harness.
 * 2. Chrome 152 calls execute() without a second argument, so the execution
 *    options object must be treated as optional in tool code.
 */
declare namespace WebMCP {
  interface ModelContext {
    /**
     * Chromium extension. Executes a registered tool with a JSON string of
     * arguments and resolves with the tool output serialised as a string.
     */
    executeTool?(
      tool: RegisteredTool,
      inputJson: string,
      options?: { signal?: AbortSignal },
    ): Promise<string | null>;
  }
}
