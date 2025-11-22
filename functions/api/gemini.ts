/**
 * Cloudflare Pages Function (Worker)
 * Secure proxy for Gemini API calls
 *
 * Endpoint: /api/gemini
 * Method: POST
 * Body: { action: 'generate' | 'analyze', payload: {...} }
 */

interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, payload } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/';
    let geminiConfig: any;

    if (action === 'generate') {
      // Generate song configuration
      const { theme, mode } = payload;

      geminiEndpoint += 'gemini-2.0-flash-exp:generateContent';

      const systemInstruction = mode === 'CHALLENGE'
        ? 'You are a sound designer and creative writer.'
        : 'You are an expert avant-garde synthesizer sound designer.';

      const prompt = mode === 'CHALLENGE'
        ? `Create a configuration for a musical typing game based on the theme: "${theme}".
           1. Create a text passage that is rhythmic, evocative, and pleasant to type (40-60 words).
           2. Define a sound synthesizer profile that matches the theme (e.g., Cyberpunk = Sawtooth/Distortion, Nature = Sine/Reverb).

           Return JSON with:
           - text: string
           - mood: string
           - tempo: number (60-140)
           - soundProfile: object`
        : `Create a unique, highly stylized, and specific sound synthesizer configuration for a free-typing musical experience based on the theme: "${theme}".

           The user will type freely to create music. The sound should be distinct, avoiding generic presets.
           Be bold with the ADSR settings and filter Q to create texture.

           Return JSON with:
           - text: (Empty string)
           - mood: string
           - tempo: number (60-140)
           - soundProfile: object`;

      geminiConfig = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 1.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              mood: { type: 'string' },
              tempo: { type: 'number' },
              soundProfile: {
                type: 'object',
                properties: {
                  oscillatorType: { type: 'string', enum: ['sine', 'square', 'sawtooth', 'triangle'] },
                  attack: { type: 'number' },
                  decay: { type: 'number' },
                  sustain: { type: 'number' },
                  release: { type: 'number' },
                  filterFreq: { type: 'number' },
                  filterQ: { type: 'number' },
                  distortion: { type: 'number' },
                  reverbMix: { type: 'number' },
                },
                required: ['oscillatorType', 'attack', 'decay', 'sustain', 'release', 'filterFreq', 'filterQ', 'distortion', 'reverbMix']
              }
            },
            required: ['text', 'mood', 'tempo', 'soundProfile'],
          },
        },
      };
    } else if (action === 'analyze') {
      // Analyze typing performance
      const { stats, song } = payload;

      geminiEndpoint += 'gemini-2.0-flash-exp:generateContent';

      const prompt = `Analyze this typing performance for the text theme "${song.theme}".
        Stats: ${stats.wpm} WPM, ${stats.accuracy}% accuracy, ${stats.mistakes} mistakes.

        Act as a witty, mystical music conductor.
        Give a creative title to their performance.
        Write a short critique (2 sentences max).
        Give a score out of 100.`;

      geminiConfig = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              critique: { type: 'string' },
              score: { type: 'number' }
            },
            required: ['title', 'critique', 'score']
          }
        }
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Call Gemini API
    const geminiResponse = await fetch(`${geminiEndpoint}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiConfig),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Gemini API request failed', details: errorText }),
        { status: geminiResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract text from Gemini response structure
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: 'No content in Gemini response' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Return the parsed JSON
    const parsedData = JSON.parse(textContent);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
