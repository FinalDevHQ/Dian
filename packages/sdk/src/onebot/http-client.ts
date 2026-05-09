import type { OneBotActionRequest, OneBotActionResponse, OneBotHttpConfig } from "./types.js";

export class OneBotHttpClient {
  constructor(private readonly config: OneBotHttpConfig) {}

  async request<TData = unknown>(body: OneBotActionRequest): Promise<OneBotActionResponse<TData>> {
    void body;
    void this.config;

    return {
      ok: false,
      status: "failed",
      message: "OneBotHttpClient is not implemented yet",
    };
  }
}
