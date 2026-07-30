import urllib.request
import re
import json
import csv
import io

# 1 y 2. Descargar datos del INE (Tabla de padrón por municipios)
url = 'https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/29005.csv'
try:
    response = urllib.request.urlopen(url)
except:
    url = 'https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2911.csv'
    response = urllib.request.urlopen(url)

data = response.read().decode('utf-8-sig', errors='replace')

# Analizar CSV
reader = csv.DictReader(io.StringIO(data), delimiter=';')

pop_data = {}
for row in reader:
    if 'Sexo' in row and row['Sexo'] != 'Total':
        continue
    
    muni_str = row.get('Municipios', '')
    period = row.get('Periodo', '')
    total_str = row.get('Total', '').replace('.', '')
    
    if not muni_str or not period or not total_str:
        continue
    
    try:
        total = float(total_str.replace(',', '.'))
    except ValueError:
        continue
        
    year = int(period)
    # Extraer el nombre del municipio (quitando el código numérico inicial)
    muni_name = ' '.join(muni_str.split(' ')[1:])
    
    if muni_name not in pop_data:
        pop_data[muni_name] = {}
    pop_data[muni_name][year] = total

# 3. Leer poblacion.js
pob_file = '/home/miguel/Proyectos/Notarios/poblacion.js'
with open(pob_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extraer los municipios
matches = re.findall(r'"([^|]+)\|([^"]+)":', content)

results = {}

def clean_name(name):
    # Normalizar para buscar coincidencias
    name = name.lower().replace("'", "").replace("-", " ")
    return name

for loc, prov in matches:
    key = f"{loc}|{prov}"
    loc_clean = clean_name(loc)
    
    best_muni = None
    # 1. Búsqueda exacta
    for m in pop_data.keys():
        if loc_clean == clean_name(m):
            best_muni = m
            break
            
    # 2. Búsqueda parcial (ej. A Coruña vs Coruña, A)
    if not best_muni:
        for m in pop_data.keys():
            m_clean = clean_name(m)
            # Manejar el caso de municipio con / (ej. Vitoria-Gasteiz)
            if loc_clean in m_clean or m_clean in loc_clean:
                best_muni = m
                break
            
    if best_muni:
        available_years = sorted(pop_data[best_muni].keys())
        if not available_years:
            continue
            
        # Buscar el año más cercano a 2013 y 2023
        y_old = min(available_years, key=lambda x: abs(x - 2013))
        y_new = min(available_years, key=lambda x: abs(x - 2023))
        
        p_old = pop_data[best_muni][y_old]
        p_new = pop_data[best_muni][y_new]
        
        # 4. Calcular % de crecimiento
        if p_old > 0:
            crecimiento = round(((p_new - p_old) / p_old) * 100, 2)
            results[key] = {
                "crecimiento": crecimiento,
                "pobAntigua": int(p_old),
                "pobActual": int(p_new),
                "añoAntiguo": y_old,
                "añoActual": y_new
            }

# 5. Escribir evolucion_pob.js
out_file = '/home/miguel/Proyectos/Notarios/evolucion_pob.js'
with open(out_file, 'w', encoding='utf-8') as f:
    f.write("const DATA_EVOLUCION_POB = ")
    f.write(json.dumps(results, indent=2, ensure_ascii=False))
    f.write(";\n")

print(f"Archivo {out_file} creado con {len(results)} municipios.")
