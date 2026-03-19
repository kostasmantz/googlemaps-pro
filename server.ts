import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint to parse Google Maps list
  app.post("/api/parse-list", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      // 1. Fetch the page with more realistic headers to avoid consent screens/blocks
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1"
        },
        maxRedirects: 5,
        timeout: 10000
      });

      const html = response.data;
      
      // Check if we got a consent page
      if (html.includes("consent.google.com") || html.includes("google.com/consent")) {
        return res.status(422).json({ 
          error: "Google is blocking the automated import with a consent screen. Please try copying the list text and using 'Manual' entry for now, or ensure the list is fully public." 
        });
      }

      const $ = cheerio.load(html);
      const places: any[] = [];
      let dataFound = false;

      // 2. Try to find structured data in scripts
      const scripts = $("script");
      scripts.each((i, el) => {
        const content = $(el).html() || "";
        
        // Pattern 1: window.APP_INITIALIZATION_STATE or window._initData
        if (content.includes("window.APP_INITIALIZATION_STATE") || content.includes("window._initData") || content.includes("var _initData")) {
          // Look for patterns like [null,"Name","Address"]
          // We use a very broad regex to catch as many as possible
          const patterns = [
            /\[null,"([^"]+)","([^"]+)"/g,
            /\["([^"]+)","([^"]+)",\[null,null,-?\d+\.\d+,-?\d+\.\d+\]/g,
            /\[null,"([^"]+)","([^"]+)",null,null,\[-?\d+\.\d+,-?\d+\.\d+\]/g,
            /\["([^"]+)","([^"]+)"/g // Even more aggressive
          ];

          for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const name = match[1];
              const address = match[2];
              
              // Filter out common non-place strings
              if (name && address && name.length > 2 && address.length > 5 && 
                  !name.startsWith("http") && name.length < 100 && 
                  !name.includes("Google") && !address.includes("http")) {
                
                // Try to find coordinates nearby
                const subContent = content.substring(match.index, match.index + 1000);
                const coordMatch = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/.exec(subContent) || 
                                  /\[(-?\d+\.\d+),(-?\d+\.\d+)\]/.exec(subContent);
                
                places.push({
                  name,
                  address,
                  latitude: coordMatch ? parseFloat(coordMatch[1]) : 0,
                  longitude: coordMatch ? parseFloat(coordMatch[2]) : 0,
                  category: "Other"
                });
                dataFound = true;
              }
            }
          }
        }
      });

      // 3. Fallback: Search the entire HTML for the same patterns
      if (!dataFound) {
        const fallbackRegex = /\[null,"([^"]+)","([^"]+)"/g;
        let match;
        while ((match = fallbackRegex.exec(html)) !== null) {
          const name = match[1];
          const address = match[2];
          if (name && address && name.length > 2 && address.length > 5 && !name.startsWith("http") && name.length < 100) {
            places.push({
              name,
              address,
              latitude: 0,
              longitude: 0,
              category: "Other"
            });
            dataFound = true;
          }
        }
      }

      // 4. Last resort: Look for meta tags (sometimes lists have them for the first few items)
      if (!dataFound) {
        $('meta[property="og:title"]').each((i, el) => {
          const title = $(el).attr('content');
          if (title && !title.includes('Google Maps')) {
            // This usually only gives the list title, not items
          }
        });
      }

      // De-duplicate places by name and address
      const uniquePlaces = Array.from(new Map(places.map(p => [`${p.name}|${p.address}`, p])).values());

      if (uniquePlaces.length === 0) {
        return res.status(422).json({ 
          error: "No places found. Please ensure the list is public and the link is correct. Some lists might be protected by Google's security measures." 
        });
      }

      res.json({ places: uniquePlaces });
    } catch (error: any) {
      console.error("Error parsing list:", error.message);
      res.status(500).json({ error: "Failed to parse the list. Make sure it's a public Google Maps list." });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
