import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import {CustomAnthropicClient} from "./llm_clients/custom_anthropic_client.js";

dotenv.config();

const StagehandConfig: ConstructorParams = {
  verbose: 1 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // LLM configuration
  // modelName: "anthropic/claude-sonnet-4-20250514" /* Name of the model to use */,
  llmClient: new CustomAnthropicClient({
    // modelName: "claude-opus-4-20250514",
    modelName: process.env.MODEL_NAME || "claude-sonnet-4-20250514",
    baseURL: process.env.BASE_URL || "http://localhost:5789",
  }),

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  // apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  // projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  // browserbaseSessionID: undefined /* Session ID for resuming Browserbase sessions */,
  // browserbaseSessionCreateParams: {
  //   projectId: process.env.BROWSERBASE_PROJECT_ID!,
  //   browserSettings: {
  //     blockAds: true,
  //     viewport: {
  //       width: 1024,
  //       height: 768,
  //     },
  //   },
  // },
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;
