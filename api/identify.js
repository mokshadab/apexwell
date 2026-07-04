// api/identify.js — Vercel serverless function.
// Species identification via Claude Haiku Vision. NATURE domain only.
//
// Called by CaptureMode with: { image: base64String, mimeType: string }
// Returns JSON: { species, scientificName, confidence, habitat, interesting }
//
// The ANTHROPIC_API_KEY lives ONLY in Vercel environment variables —
// never in the browser bundle (Section 27.1). This function is the
// boundary: the browser sends a photo, the server calls Claude.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

// Safe fallback returned when identification cannot be completed.
// CaptureMode still saves the discovery — the student names it herself.
const FALLBACK = {
  species: 'Unidentified',
  scientificName: '',
  confidence: 0,
  habitat: 'Mixed',
  interesting: '',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Misconfiguration — return fallback so the app never blocks.
    res.status(200).json(FALLBACK);
    return;
  }

  const { image, mimeType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }

  const media = mimeType || 'image/jpeg';

  const systemPrompt =
    'You are helping a 15-year-old student naturalist in North Carolina ' +
    'identify organisms she photographs in the field. Be accurate and ' +
    'encouraging. Always attempt identification even if unsure.';

  const userText =
    'Identify this organism. Return ONLY valid JSON:\n' +
    '{\n' +
    '  "species": "common name",\n' +
    '  "scientificName": "Genus species",\n' +
    '  "confidence": 85,\n' +
    '  "habitat": "Wetland | Forest edge | Mixed | Shoreline | Open field | Urban garden",\n' +
    '  "interesting": "one sentence ecological significance"\n' +
    '}\n' +
    'Never refuse. Always return this structure. Low confidence if unsure.';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: media,
                  data: image,
                },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      res.status(200).json(FALLBACK);
      return;
    }

    const data = await response.json();

    // Extract the text block from Claude's response.
    const textBlock =
      Array.isArray(data.content) &&
      data.content.find((b) => b.type === 'text');
    const raw = textBlock ? textBlock.text : '';

    // Parse the JSON Claude returned. Strip accidental code fences.
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(200).json(FALLBACK);
      return;
    }

    // Normalize and clamp, so the client always gets a safe shape.
    const result = {
      species: typeof parsed.species === 'string' ? parsed.species : FALLBACK.species,
      scientificName:
        typeof parsed.scientificName === 'string' ? parsed.scientificName : '',
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 0,
      habitat: typeof parsed.habitat === 'string' ? parsed.habitat : 'Mixed',
      interesting: typeof parsed.interesting === 'string' ? parsed.interesting : '',
    };

    res.status(200).json(result);
  } catch {
    // Timeout or network error — never block the capture flow.
    res.status(200).json(FALLBACK);
  }
}

