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

    const prompt = `Eres un experto asistente diseñado para ayudar a notarios a encontrar y clasificar sus plazas ideales en España.
Tu tarea es analizar la consulta del usuario y filtrar u ordenar la lista de vacantes proporcionada según sus criterios exactos.

DATOS DE LAS VACANTES:
La lista contiene objetos JSON con:
- _id: Identificador único (ESTE ES EL QUE DEBES DEVOLVER).
- l: Localidad
- p: Provincia
- c: Comunidad Autónoma
- clase: Clase de la notaría (1ª, 2ª, 3ª)
- categoria: Categoría de la notaría (1ª, 2ª, 3ª)
- pob: Población de la localidad
- dCosta: Distancia a la costa/mar en km (si le gusta el mar, busca valores bajos o 0)
- dMont: Distancia a la montaña en km
- renta: Renta media
- distancia: Distancia en línea recta desde la ubicación del usuario (en km). Si es null, el usuario no ha definido su ubicación.
- minutosCoche: Tiempo estimado en coche desde la ubicación del usuario (en minutos). Si es null, el usuario no ha definido su ubicación.

LISTA DE VACANTES DISPONIBLES:
${JSON.stringify(vacantes)}

CONSULTA DEL USUARIO:
"${query}"

INSTRUCCIONES CRÍTICAS:
1. Comprende los criterios del usuario con precisión matemática. Si pide "menos de 45 minutos", filtra estrictamente por minutosCoche < 45. Si odia una comunidad, exclúyela.
2. Si el usuario pide ORDENAR toda la lista (ej. "ordéname las plazas", "hazme una lista"), DEBES devolver TODOS los IDs (o todos los que cumplan sus filtros) ordenados secuencialmente según sus prioridades. NO te limites a 10 resultados en este caso, devuelve todos los necesarios (hasta los 207 si hace falta).
3. Si la petición es solo una búsqueda genérica (ej. "dime pueblos con playa"), puedes devolver los mejores (ej. top 10 o 20).
4. Explica brevemente (2-3 frases) la lógica exacta que has aplicado para filtrar y ordenar.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON EXACTO:
{
  "matches": ["_id1", "_id2", "_id3", ...],
  "explicacion": "He seleccionado/ordenado estos pueblos porque..."
}
NO añadas markdown (\`\`\`), SOLO devuelve el JSON válido.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
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
