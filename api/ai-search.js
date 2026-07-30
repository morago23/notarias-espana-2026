export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada.' });
  }

  try {
    const { query, vacantes } = req.body;

    if (!query || !vacantes || !Array.isArray(vacantes)) {
      return res.status(400).json({ error: 'Falta la consulta (query) o el array de vacantes.' });
    }

    const prompt = `Eres un asistente inteligente diseñado para ayudar a notarios a encontrar su plaza ideal en España.
Tu tarea es analizar la consulta del usuario y seleccionar los pueblos/plazas que mejor encajen con lo que pide, basándote en la lista proporcionada.

LISTA DE VACANTES DISPONIBLES:
${JSON.stringify(vacantes)}

CONSULTA DEL USUARIO:
"${query}"

INSTRUCCIONES:
1. Analiza semánticamente la consulta (ej. "playa" implica distCosta baja, "norte" implica Asturias, Cantabria, Galicia, País Vasco, etc. "tranquilo" implica poca población, "ciudad" implica mucha población).
2. Evalúa las vacantes de la lista.
3. Devuelve los IDs de los pueblos que MEJOR encajen (máximo 10, mínimo 1).
4. Explica brevemente (1 o 2 frases, máximo 30 palabras) por qué has elegido esos pueblos.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON EXACTO:
{
  "matches": ["_id1", "_id2", ...],
  "explicacion": "He seleccionado estos pueblos porque..."
}
NO añadas comillas invertidas (\`\`\`) ni markdown, SOLO devuelve el JSON válido.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(500).json({ error: 'Error comunicando con Gemini', details: data });
    }

    let resultText = data.candidates[0].content.parts[0].text.trim();
    // Remover backticks de markdown si la IA los incluye
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
    }
    const resultJson = JSON.parse(resultText);

    return res.status(200).json(resultJson);

  } catch (error) {
    console.error('Error en ai-search:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}
