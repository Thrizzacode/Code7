const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');

/**
 * @param {string} provider - 'gemini' | 'groq'
 * @param {string} apiKey
 * @param {string} promptTemplate
 * @param {Array<{path: string, itemStatus: string}>} entries
 * @param {string} diffText
 */
async function generateCommitMessage(provider, apiKey, promptTemplate, entries, diffText) {
  if (!apiKey) {
    return { success: false, error: 'API_KEY_MISSING' };
  }

  const fileList = entries
    .map((entry) => `- [${entry.itemStatus}] ${entry.path}`)
    .join('\n');

  const diffSection = diffText && diffText.trim() ? diffText : '(無 diff 內容)';

  const userContent = `${promptTemplate}

## 變更檔案清單

${fileList}

## Diff 內容

${diffSection}`;

  try {
    if (provider === 'groq') {
      return await _callGroq(apiKey, userContent);
    }
    return await _callGemini(apiKey, userContent);
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

async function _callGemini(apiKey, contents) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
  });
  const text = response.text;
  if (!text || !text.trim()) {
    return { success: false, error: 'EMPTY_RESPONSE' };
  }
  return { success: true, message: text.trim() };
}

async function _callGroq(apiKey, content) {
  const client = new Groq({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content }],
  });
  const text = completion.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    return { success: false, error: 'EMPTY_RESPONSE' };
  }
  return { success: true, message: text.trim() };
}

module.exports = { generateCommitMessage };
