// In production, use relative URLs (same origin). In dev, use localhost:8000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolUsed {
  name: string;
  args: Record<string, unknown>;
}

export interface StructuredDataItem {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AskResponse {
  answer: string;
  structured_data: StructuredDataItem[];
  tools_used: ToolUsed[];
}

export async function askAgent(
  question: string,
  chatHistory: ChatMessage[] = []
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      chat_history: chatHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    return data.status;
  } catch {
    return "offline";
  }
}
