const fs = require('fs');
const apiKey = fs.readFileSync('.env.local', 'utf8').match(/GEMINI_API_KEY=(.*)/)[1].trim();

const vacantesLigero = [
  { _id: 'madrid|madrid', l: 'Madrid', p: 'Madrid', c: 'Madrid', pob: 3000000, dCosta: 300, dMont: 50, renta: 30000 }
];

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: `Eres un asistente... 
VACANTES: ${JSON.stringify(vacantesLigero)}
QUERY: quiero ir a la playa
JSON FORMAT: {"matches": [], "explicacion": ""}` }] }],
    generationConfig: { temperature: 0.2, response_mime_type: 'application/json' }
  })
}).then(res => res.json()).then(d => console.log(JSON.stringify(d))).catch(console.error);
