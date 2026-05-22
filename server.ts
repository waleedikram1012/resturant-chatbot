import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Grok/AI Extraction
  app.post("/api/grok", async (req, res) => {
    const { message } = req.body;
    const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;

    // Hardcode fallback behaviors for common phrases so UI works nicely locally without a real key
    const lowerMessage = message.toLowerCase();
    
    // Check Guardrails First
    const guardrailKeywords = ["weather", "history", "programming", "javascript", "react", "who are you"];
    if (guardrailKeywords.some(k => lowerMessage.includes(k))) {
       return res.json({ intent: "GUARDRAIL_BLOCKED" });
    }

    if (!apiKey || apiKey === "your_xai_grok_api_key_here") {
      // MOCK FALLBACK for preview
      if (lowerMessage.includes("zinger") && lowerMessage.includes("2")) {
        return res.json({ intent: "ORDER_ITEM", quantity: 2, item: "Zinger Burger", subtotal: 900 });
      }
      if (lowerMessage.includes("cheese blast") && lowerMessage.includes("1")) {
        return res.json({ intent: "ORDER_ITEM", quantity: 1, item: "Cheese Blast Burger", subtotal: 550 });
      }
      if (lowerMessage.includes("burger")) {
        // missing from menu -> handled by exact text checking
        if (!lowerMessage.includes("zinger") && !lowerMessage.includes("cheese") && !lowerMessage.includes("jalapeno") && !lowerMessage.includes("decker")) {
           return res.json({ intent: "ITEM_NOT_FOUND" });
        }
      }
      return res.json({ intent: "UNKNOWN", text: message });
    }

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-2-latest", // using a standard model string
          messages: [
            { 
              role: "system", 
              content: `You are an intent extractor for SpiceHub, an Urdu/English food ordering chatbot.
              Menu items: 'Zinger Burger' (450), 'Cheese Blast Burger' (550), 'Grilled Jalapeno Burger' (520), 'Double Decker Monster Burger' (750).
              Output JSON with { "intent": "ORDER_ITEM", "quantity": number, "item": string, "subtotal": number }. 
              If the item requested is not on the menu but is a food item, output { "intent": "ITEM_NOT_FOUND" }.
              If the prompt talks about external out-of-context topics (general knowledge, programming, weather), output { "intent": "GUARDRAIL_BLOCKED" }`
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`Grok API warning (Extraction): ${response.statusText}. Using fallback extraction.`);
        
        // MOCK FALLBACK for preview
        if (lowerMessage.includes("zinger") && lowerMessage.includes("2")) {
          return res.json({ intent: "ORDER_ITEM", quantity: 2, item: "Zinger Burger", subtotal: 900 });
        }
        if (lowerMessage.includes("cheese blast") && lowerMessage.includes("1")) {
          return res.json({ intent: "ORDER_ITEM", quantity: 1, item: "Cheese Blast Burger", subtotal: 550 });
        }
        if (lowerMessage.includes("burger")) {
          if (!lowerMessage.includes("zinger") && !lowerMessage.includes("cheese") && !lowerMessage.includes("jalapeno") && !lowerMessage.includes("decker")) {
             return res.json({ intent: "ITEM_NOT_FOUND" });
          }
        }
        return res.json({ intent: "UNKNOWN", text: message });
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      try {
        const parsed = JSON.parse(content);
        res.json(parsed);
      } catch (e) {
        // Fallback parsing if grok didn't return pure JSON
        res.json({ intent: "UNKNOWN", raw: content });
      }
    } catch (error: any) {
      console.warn("Grok Proxy Warning (Extraction):", error.message, ". Using fallback extraction.");
      res.json({ intent: "UNKNOWN", text: message });
    }
  });

  // API Route for Grok Address Validation
  app.post("/api/grok/validate-address", async (req, res) => {
    const { address } = req.body;
    const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;

    if (!apiKey || apiKey === "your_xai_grok_api_key_here") {
      // MOCK FALLBACK for preview
      if (address.length > 5 && address.includes(" ")) return res.json({ result: "VALID" });
      return res.json({ result: "INVALID" });
    }

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-2-latest",
          messages: [
            { 
              role: "system", 
              content: "You are a validation bot. The user typed an address. Is this a realistic physical delivery address? Reply with exactly 'VALID' or 'INVALID'."
            },
            {
              role: "user",
              content: address
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`Grok API warning (Validation): ${response.statusText}. Using fallback validation.`);
        return res.json({ result: (address && address.length > 5) ? "VALID" : "INVALID" });
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim().toUpperCase();
      res.json({ result: content.includes("VALID") && !content.includes("INVALID") ? "VALID" : "INVALID" });
    } catch (error: any) {
      console.warn("Grok Proxy Warning (Validation):", error.message, ". Using fallback validation.");
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
