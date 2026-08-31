export type DeepSeekResponseBody = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export function extractDeepSeekOutput(body: DeepSeekResponseBody) {
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}
