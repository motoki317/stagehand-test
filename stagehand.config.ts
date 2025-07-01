import type { ConstructorParams, LLMClient } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import { CustomAnthropicClient } from "./llm_clients/custom_anthropic_client.js";
import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client.js";
import OpenAI from "openai";

dotenv.config();

const llmClient = ((): LLMClient => {
  if (process.env.OPENAI_API_KEY) {
    return new CustomOpenAIClient({
      modelName: process.env.MODEL_NAME || 'gpt-4.1-mini',
      client: new OpenAI({
        baseURL: process.env.BASE_URL || "http://localhost:4000",
      }),
    })
  }
  return new CustomAnthropicClient({
    // modelName: "claude-opus-4-20250514",
    modelName: process.env.MODEL_NAME || "claude-sonnet-4-20250514",
    baseURL: process.env.BASE_URL || "http://localhost:5789",
  })
})();

// Factory function to create config with dynamic browser settings
export const createStagehandConfig = (target: 'desktop' | 'mobile' = 'desktop'): ConstructorParams => ({
  verbose: 1 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // LLM configuration
  // modelName: "anthropic/claude-sonnet-4-20250514" /* Name of the model to use */,
  llmClient,

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
  }
});

const StagehandConfig = createStagehandConfig();

export default StagehandConfig;
