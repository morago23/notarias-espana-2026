const fs = require('fs');

async function fetchPopulationData() {
  const query = `
    SELECT ?townLabel ?provinceLabel ?year ?population WHERE {
      ?town wdt:P31/wdt:P279* wd:Q2074737 ;
            wdt:P17 wd:Q29 ;
            wdt:P131+ ?province ;
            p:P1082 ?popStatement .
      ?popStatement ps:P1082 ?population ;
                    pq:P585 ?date .
      BIND(YEAR(?date) AS ?year)
      FILTER(?year IN (2013, 2023))
      
      # Provincias (simplificado)
      ?province wdt:P31/wdt:P279* wd:Q194123 .
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es". }
    }
  `;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'NotariosBot/1.0 (miguel@example.com)' } });
    if (!res.ok) { console.error("HTTP error", res.status); return; }
    const data = await res.json();
    fs.writeFileSync('wikidata_pop.json', JSON.stringify(data, null, 2));
    console.log("Saved", data.results.bindings.length, "records");
  } catch(e) {
    console.error(e);
  }
}
fetchPopulationData();
