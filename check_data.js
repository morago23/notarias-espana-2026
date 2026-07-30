const fs = require('fs');

// Mock DOM/environment if needed
eval(fs.readFileSync('data.js', 'utf8'));
eval(fs.readFileSync('poblacion.js', 'utf8'));
eval(fs.readFileSync('renta.js', 'utf8'));

let missingPob = 0;
let missingRenta = 0;
let total = 0;

const uniqueTowns = new Set();
DATA_VACANTES.forEach(v => {
  const loc = v.localidad.replace(/\s*\([^)]*\)/g, '').trim();
  const prov = v.provincia;
  const id = loc + '|' + prov;
  if (!uniqueTowns.has(id)) {
    uniqueTowns.add(id);
    total++;
    
    // Check pob
    let pobFound = false;
    for (let key in DATA_POBLACION) {
      if (key.toLowerCase() === id.toLowerCase()) {
        pobFound = true;
        break;
      }
    }
    if (!pobFound) { missingPob++; console.log("Missing Pob:", id); }
    
    // Check renta
    let rentaFound = false;
    for (let key in DATA_RENTA) {
      if (key.toLowerCase() === id.toLowerCase()) {
        rentaFound = true;
        break;
      }
    }
    if (!rentaFound) { missingRenta++; console.log("Missing Renta:", id); }
  }
});

console.log(`Total unique towns: ${total}`);
console.log(`Missing Poblacion: ${missingPob}`);
console.log(`Missing Renta: ${missingRenta}`);
