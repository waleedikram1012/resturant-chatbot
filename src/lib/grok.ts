export async function extractIntent(message: string, systemPrompt?: string, history?: any[]): Promise<any> {
    try {
      const response = await fetch("/api/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, systemPrompt, history }),
      });
      if (!response.ok) {
        return { intent: "UNKNOWN", error: "Failed to connect to AI server" };
      }
      return await response.json();
    } catch (e) {
      console.error(e);
      return { intent: "UNKNOWN" };
    }
}

export async function validateAddress(address: string): Promise<boolean> {
    try {
      const response = await fetch("/api/grok/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) return true; // fallback to true to prevent blocking
      const data = await response.json();
      return data.result === "VALID";
    } catch (e) {
      console.error(e);
      return true; // fallback to true
    }
}
