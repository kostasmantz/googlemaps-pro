import { GoogleGenAI, Type } from "@google/genai";
import { Category } from "../types";

// `tsconfig.json` does not include Node types; we only use `process.env` as Vite defines.
declare const process: { env: Record<string, string | undefined> };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Important: do not initialize Gemini at module-load if the key is missing.
// Otherwise the whole app can crash on startup when the app is served without secrets.
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export interface ExtractedPlace {
  name: string;
  address: string;
  categories: Category[];
  googleMapsUrl: string;
  note?: string;
  latitude?: number;
  longitude?: number;
}

export async function extractPlacesFromText(text: string): Promise<ExtractedPlace[]> {
  try {
    if (!ai) {
      throw new Error(
        "Gemini API key is not configured. Set `GEMINI_API_KEY` in GitHub Secrets and redeploy."
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract all places from the following text which was copied from a Google Maps list:
      
      "${text}"
      
      For each place, provide:
      - name: The name of the place
      - address: The full address
      - categories: Array of categories, choosing from: Restaurant, Cafe, Campsite, Other
      - googleMapsUrl: The URL to the place on Google Maps if available
      - note: Any short description or note if available
      - latitude: The approximate latitude of the place if you can determine it
      - longitude: The approximate longitude of the place if you can determine it
      
      Return the data as a JSON array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              categories: { 
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  enum: ["Restaurant", "Cafe", "Campsite", "Other"]
                }
              },
              googleMapsUrl: { type: Type.STRING },
              note: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER }
            },
            required: ["name", "address", "categories"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return [];
    
    return JSON.parse(resultText) as ExtractedPlace[];
  } catch (error) {
    console.error("Error extracting places from text:", error);
    throw error;
  }
}
