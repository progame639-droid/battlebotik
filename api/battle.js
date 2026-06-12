export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { provider, model, messages } = req.body;

  try {
    // ── Попытка вызвать провайдера, с fallback на Gemini при rate limit ──
    const result = await callWithFallback(provider, model, messages);
    if (!result.text) return res.status(500).json({ error: 'Пустой ответ от модели. Попробуй ещё раз.' });
    res.status(200).json({ text: result.text, usedProvider: result.usedProvider });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function callWithFallback(provider, model, messages) {
  // Сначала пробуем основного провайдера
  try {
    const text = await callProvider(provider, model, messages);
    return { text, usedProvider: provider };
  } catch (e) {
    const isRateLimit = e.message?.includes('Rate limit') || e.message?.includes('rate limit') ||
                        e.message?.includes('429') || e.message?.includes('quota') ||
                        e.message?.includes('TPD') || e.message?.includes('TPM');

    // Если это rate limit и провайдер — groq, пробуем Gemini как запасной
    if (isRateLimit && provider === 'groq') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const text = await callProvider('gemini', 'gemini-2.0-flash', messages);
          return { text, usedProvider: 'gemini-fallback' };
        } catch (e2) {
          // Gemini тоже не ответил — пробуем Cohere если есть ключ
          const cohereKey = process.env.COHERE_API_KEY;
          if (cohereKey) {
            const text = await callProvider('cohere', 'command-a-03-2025', messages);
            return { text, usedProvider: 'cohere-fallback' };
          }
        }
      }
    }

    // Если cohere rate limit — пробуем Gemini
    if (isRateLimit && provider === 'cohere') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const text = await callProvider('gemini', 'gemini-2.0-flash', messages);
        return { text, usedProvider: 'gemini-fallback' };
      }
    }

    throw e; // не смогли восстановиться
  }
}

async function callProvider(provider, model, messages) {
  let text;

  // ── GROQ ──────────────────────────────────────────────
  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not configured');

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, messages, max_tokens: 100, temperature: 0.9, frequency_penalty: 0.7 })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Groq error ' + r.status);
    text = d.choices?.[0]?.message?.content;

  // ── COHERE ────────────────────────────────────────────
  } else if (provider === 'cohere') {
    const key = process.env.COHERE_API_KEY;
    if (!key) throw new Error('COHERE_API_KEY not configured');

    const system = messages.find(m => m.role === 'system')?.content || '';
    const chat = messages.filter(m => m.role !== 'system');
    const lastMsg = chat.pop();
    const chatHistory = chat.map(m => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: m.content
    }));

    const r = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model,
        preamble: system,
        chat_history: chatHistory,
        message: lastMsg?.content || '',
        max_tokens: 100,
        temperature: 0.8
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Cohere error ' + r.status);
    text = d.text;

  // ── GEMINI ────────────────────────────────────────────
  } else if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured');

    const system = messages.find(m => m.role === 'system')?.content || '';
    const chat = messages.filter(m => m.role !== 'system');
    const contents = chat.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: 200 }
        })
      }
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Gemini error ' + r.status);
    text = d.candidates?.[0]?.content?.parts?.[0]?.text;

  } else {
    throw new Error('Unknown provider: ' + provider);
  }

  if (!text) throw new Error('Пустой ответ от модели');
  return text;
}
