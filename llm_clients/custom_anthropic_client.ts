/******************************************************************************
 * YOU PROBABLY DON'T WANT TO BE USING THIS FILE DIRECTLY                      *
 * INSTEAD, EDIT `stagehand.config.ts` TO MODIFY THE CLIENT CONFIGURATION      *
 ******************************************************************************/

/**
 * Welcome to the Stagehand custom OpenAI client!
 *
 * This is a client for models that are compatible with the OpenAI API, like Ollama, Gemini, etc.
 * You can just pass in an OpenAI instance to the client and it will work.
 */

import {
  AvailableModel,
  CreateChatCompletionOptions,
  LLMClient, LLMResponse,
} from "@browserbasehq/stagehand";
import { Anthropic } from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ContentBlockParam, TextBlockParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { zodToJsonSchema } from 'zod-to-json-schema';

export class CustomAnthropicClient extends LLMClient {
  public type = "anthropic" as const;
  public modelName: string;
  private client: Anthropic;

  public constructor({ modelName, baseURL }: { modelName: string; baseURL: string }) {
    super(modelName as AvailableModel);
    this.modelName = modelName;
    this.client = new Anthropic({ baseURL, apiKey: 'sk-dummy' })
  }

  public async createChatCompletion<T = LLMResponse & {
    usage?: LLMResponse["usage"]
  }>(options: CreateChatCompletionOptions): Promise<T> {
    const { messages, temperature, top_p, tools, tool_choice, maxTokens, response_model } = options.options;
    
    // Extract system message if present
    const systemMessage = messages.find(msg => msg.role === 'system')?.content;
    const system = typeof systemMessage === 'string' ? systemMessage : undefined;
    
    // Convert messages to Anthropic format, filtering out system messages
    const anthropicMessages: MessageParam[] = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : msg.content.map(content => {
          if ('text' in content && content.text) {
            const textBlock: TextBlockParam = { type: 'text', text: content.text };
            return textBlock;
          } else if ('image_url' in content && content.image_url) {
            // Handle image URLs - Anthropic expects base64
            const imageBlock: ImageBlockParam = { 
              type: 'image', 
              source: {
                type: 'base64',
                media_type: 'image/jpeg', // You may need to determine this dynamically
                data: content.image_url.url.replace(/^data:image\/[a-z]+;base64,/, '')
              }
            };
            return imageBlock;
          }
          const fallbackBlock: TextBlockParam = { type: 'text', text: '' };
          return fallbackBlock;
        }) as ContentBlockParam[]
      }));
    
    // If response_model is provided, use tool calling to get structured output
    let anthropicTools: Tool[] | undefined;
    let toolChoiceToUse = tool_choice;
    
    if (response_model) {
      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(response_model.schema, {
        target: 'openApi3',
        $refStrategy: 'none'
      }) as any;
      
      // Create a tool for structured output
      const structuredOutputTool: Tool = {
        name: response_model.name || 'structured_output',
        description: 'Extract structured data according to the schema',
        input_schema: {
          type: 'object' as const,
          properties: jsonSchema.properties || {},
          required: jsonSchema.required || [],
          additionalProperties: false
        }
      };
      anthropicTools = [structuredOutputTool];
      toolChoiceToUse = 'required'; // Force the model to use the tool
    } else if (tools) {
      // Convert LLMTool format to Anthropic Tool format
      anthropicTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object' as const,
          properties: (tool.parameters.properties || {}) as Record<string, any>,
          required: (tool.parameters.required || []) as string[],
          additionalProperties: false
        }
      }));
    }
    
    // Map tool_choice from OpenAI format to Anthropic format
    let anthropicToolChoice;
    if (toolChoiceToUse) {
      if (toolChoiceToUse === 'required') {
        anthropicToolChoice = { type: 'any' as const };
      } else {
        anthropicToolChoice = { type: toolChoiceToUse as 'auto' | 'none' };
      }
    }
    
    const msg = await this.client.messages.create({
      model: this.modelName,
      max_tokens: maxTokens || 1024,
      messages: anthropicMessages,
      system,
      temperature,
      top_p,
      ...(anthropicTools && { tools: anthropicTools }),
      ...(anthropicToolChoice && { tool_choice: anthropicToolChoice })
    });
    
    // If response_model was used, extract the structured data from tool calls
    if (response_model && msg.content.some(block => block.type === 'tool_use')) {
      const toolUseBlock = msg.content.find(block => block.type === 'tool_use') as any;
      if (toolUseBlock) {
        return {
          data: toolUseBlock.input,
          usage: {
            prompt_tokens: msg.usage.input_tokens,
            completion_tokens: msg.usage.output_tokens,
            total_tokens: msg.usage.input_tokens + msg.usage.output_tokens
          }
        } as T;
      }
    }
    
    // Transform Anthropic response to OpenAI format
    const response: LLMResponse = {
      id: msg.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: msg.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: msg.content
            .filter(block => block.type === 'text')
            .map(block => (block as any).text)
            .join(''),
          tool_calls: msg.content
            .filter(block => block.type === 'tool_use')
            .map(block => {
              const toolBlock = block as any;
              return {
                id: toolBlock.id,
                type: 'function',
                function: {
                  name: toolBlock.name,
                  arguments: JSON.stringify(toolBlock.input)
                }
              };
            })
        },
        finish_reason: msg.stop_reason || 'stop'
      }],
      usage: {
        prompt_tokens: msg.usage.input_tokens,
        completion_tokens: msg.usage.output_tokens,
        total_tokens: msg.usage.input_tokens + msg.usage.output_tokens
      }
    };
    
    return response as T;
  }
}
