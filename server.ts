import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // API Route for GenAI Extraction
  app.post("/api/grok", async (req, res) => {
    const { message, systemPrompt, history } = req.body;
    
    // Check Guardrails First
    if (typeof message !== 'string') {
      return res.status(400).json({ intent: "UNKNOWN", error: "Invalid or missing message." });
    }
    const lowerMessage = message.toLowerCase();
    const guardrailKeywords = ["weather", "history", "programming", "javascript", "react", "who are you"];
    if (guardrailKeywords.some(k => lowerMessage.includes(k))) {
       return res.json({ intent: "GUARDRAIL_BLOCKED" });
    }

    try {
      if (!systemPrompt) {
         return res.json({ intent: "UNKNOWN", error: "Missing system prompt configuration for the active bot." });
      }

      const finalInstruction = `${systemPrompt}\nOutput strictly valid pure JSON according to the routing rules. Example general conversational answer: { "intent": "CONVERSATIONAL", "response": "<your response>" }
      
      CRITICAL RULE 7: If the user expresses intense frustration, anger, or complaints using phrases like "farigh bot", "worst service", "call manager", "gussa", "bakwaas", or is stuck in persistent loops, YOU MUST output:
      { "intent": "ESCALATION_TRIGGER", "response": "Mujhe afsos hai ke aapko pareshani hui. Please click the button below to connect with our live manager." }`;

      let cleanHistory: any[] = [];
      if (Array.isArray(history)) {
        for (const msg of history) {
          if (msg && msg.role && Array.isArray(msg.parts) && msg.parts.length > 0 && msg.parts[0].text) {
            const role = msg.role === 'user' ? 'user' : 'model';
            const text = String(msg.parts[0].text).slice(0, 1000);
            if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
               cleanHistory[cleanHistory.length - 1].parts[0].text += `\n${text}`;
            } else {
               cleanHistory.push({ role, parts: [{ text }] });
            }
          }
        }
      }

      const finalMessage = String(message).slice(0, 2000);
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
          cleanHistory[cleanHistory.length - 1].parts[0].text += `\n${finalMessage}`;
      } else {
          cleanHistory.push({ role: 'user', parts: [{ text: finalMessage }] });
      }

      if (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
          cleanHistory.shift();
      }

      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: cleanHistory,
            config: {
              systemInstruction: finalInstruction,
              responseMimeType: 'application/json'
            }
          });
          break; // success
        } catch (e: any) {
          const msgStr = e.message || "";
          if (msgStr.includes('503') || msgStr.includes('429') || msgStr.includes('UNAVAILABLE') || msgStr.includes('high demand')) {
             retries--;
             if (retries === 0) throw e;
             await new Promise(r => setTimeout(r, 1500)); // wait before retry
          } else {
             throw e;
          }
        }
      }

      let content = response?.text || "{}";
      try {
        // Strip markdown code block if present
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        const parsed = JSON.parse(content);
        res.json(parsed);
      } catch (e) {
        // Fallback to exactly what the AI returned, wrapping it in CONVERSATIONAL
        res.json({ intent: "CONVERSATIONAL", response: response?.text || "I'm sorry, I couldn't process that properly." });
      }
    } catch (error: any) {
      console.warn("GenAI Proxy Warning (Extraction):", error.message);
      res.json({ intent: "CONVERSATIONAL", response: "Service is temporarily busy. Please try again in a few moments." });
    }
  });

  // API Route for GenAI Address Validation
  app.post("/api/grok/validate-address", async (req, res) => {
    const { address } = req.body;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: address,
        config: {
          systemInstruction: "You are a validation bot. The user typed an address. Is this a realistic physical delivery address? Reply with exactly 'VALID' or 'INVALID'."
        }
      });

      const content = (response.text || "").trim().toUpperCase();
      res.json({ result: content.includes("VALID") && !content.includes("INVALID") ? "VALID" : "INVALID" });
    } catch (error: any) {
      console.warn("GenAI Proxy Warning (Validation):", error.message);
      res.json({ result: (address && address.length > 5) ? "VALID" : "INVALID" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
