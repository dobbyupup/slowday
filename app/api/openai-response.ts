export type OpenAIResponseBody = {
  status?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
};

export function extractOpenAIOutput(body: OpenAIResponseBody) {
  if (body.status !== "completed") return null;
  const text = body.output?.flatMap(item => item.type === "message" ? item.content ?? [] : [])
    .filter(part => part.type === "output_text")
    .map(part => part.text ?? "")
    .join("") ?? "";
  return text || null;
}
