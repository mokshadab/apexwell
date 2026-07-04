// api/identify.js — Vercel serverless function.
// Species identification via Claude Haiku Vision. NATURE domain only.
// Robust JSON extraction: pulls the JSON object out of Claude's reply
// even if it is wrapped in prose or markdown fences.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

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
    res.status(200).json({ ...FALLBACK, _debug: 'no_api_key' });
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
    'encouraging. Always attempt identification even if unsure. ' +
    'Respond with ONLY a JSON object, no other text.';

  const userText =
    'Identify this organism. Return ONLY valid JSON in exactly this shape:\n' +
    '{"species":"common name","scientificName":"Genus species",' +
    '"confidence":85,"habitat":"Wetland",' +
    '"interesting":"one sentence ecological significance"}\n' +
    'Never refuse. Always return this structure. Use a low confidence ' +
    'number if unsure. Do not wrap the JSON in markdown or add any words.';

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
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: media, data: image },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      res.status(200).json({
        ...FALLBACK,
        _debug: `api_${response.status}`,
        _detail: errText.slice(0, 200),
      });
      return;
    }

    const data = await response.json();

    const textBlock =
      Array.isArray(data.content) &&
      data.content.find((b) => b.type === 'text');
    const raw = textBlock ? textBlock.text : '';

    // Robust extraction: find the first { ... } object in the text.
    let parsed = null;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        parsed = JSON.parse(candidate);
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      res.status(200).json({
        ...FALLBACK,
        _debug: 'parse_failed',
        _detail: raw.slice(0, 200),
      });
      return;
    }

    const result = {
      species:
        typeof parsed.species === 'string' && parsed.species.trim()
          ? parsed.species.trim()
          : FALLBACK.species,
      scientificName:
        typeof parsed.scientificName === 'string' ? parsed.scientificName : '',
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 0,
      habitat: typeof parsed.habitat === 'string' ? parsed.habitat : 'Mixed',
      interesting:
        typeof parsed.interesting === 'string' ? parsed.interesting : '',
    };

    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({ ...FALLBACK, _debug: 'exception', _detail: String(err).slice(0, 200) });
    return;
  }
}

