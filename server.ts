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

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history || [],
        config: {
          systemInstruction: finalInstruction,
          responseMimeType: 'application/json'
        }
      });

      const response = await chat.sendMessage(message);
      let content = response.text || "{}";
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
        res.json({ intent: "CONVERSATIONAL", response: response.text || "I'm sorry, I couldn't process that properly." });
      }
    } catch (error: any) {
      console.warn("GenAI Proxy Warning (Extraction):", error.message);
      res.json({ intent: "CONVERSATIONAL", response: "Oops, an error occurred communicating with the intelligence core." });
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
