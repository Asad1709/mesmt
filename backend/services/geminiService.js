import { GoogleGenAI, Type } from '@google/genai';

let aiClient;

function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return aiClient;
}

export async function analyzeIssueImage(base64Image, mimeType) {
  try {
    const response = await getAiClient().models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: [
      {
        inlineData: { data: base64Image, mimeType }
      },
      {
        text: 'Analyze this image of a civic issue. Look carefully for road potholes, road cracks, broken pavement, garbage piles, overflowing drains, water leaks, broken streetlights, fallen electrical wires, damaged public infrastructure, or sanitation issues. Return a short specific title such as "Large pothole on road" or "Cracked road surface", the best category (Road Maintenance, Water & Sanitation, Electrical & Streetlights, Garbage & Waste, Public Infrastructure), and a priority level based on visible severity (LOW, MEDIUM, HIGH, URGENT).'
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          priority: { type: Type.STRING }
        },
        required: ['title', 'category', 'priority']
      }
    }
  });

  if (response && response.text) {
     return JSON.parse(response.text);
  }
  throw new Error("Failed to parse Gemini response");
} catch (e) {
  if (e.message?.includes("API_KEY_INVALID") || e.message?.includes("API key not valid") || e.status === undefined || e.status === 400) {
    throw new Error("Invalid Gemini API Key. Please check the API key in Settings -> Secrets.");
  }
  throw e;
}
}
