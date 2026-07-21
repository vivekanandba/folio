import Anthropic from '@anthropic-ai/sdk'

// Resolves credentials from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login`
// profile — do not hardcode a key.
const client = new Anthropic()

export const MODELS = {
  plan: 'claude-opus-4-8', // judgment + faithful paraphrase
  concept: 'claude-opus-4-8',
  session: 'claude-sonnet-5', // structured JSON at volume
} as const

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Force schema-valid JSON via strict tool use. Streams to avoid HTTP timeouts on large outputs. */
export async function emitStructured<T = any>(opts: {
  model: string
  system: string
  user: string
  toolName: string
  schema: Record<string, any>
  maxTokens?: number
}): Promise<T> {
  const stream = client.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: `Emit the ${opts.toolName} as structured data.`,
        input_schema: opts.schema as any,
        strict: true,
      },
    ],
    tool_choice: { type: 'tool', name: opts.toolName },
    messages: [{ role: 'user', content: opts.user }],
  })
  const msg = await stream.finalMessage()
  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('Model returned no tool_use block')
  return block.input as T
}

/** Plain text generation (used for concept markdown). */
export async function emitText(opts: {
  model: string
  system: string
  user: string
  maxTokens?: number
}): Promise<string> {
  const stream = client.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  })
  const msg = await stream.finalMessage()
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}
