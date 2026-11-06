document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loadDataBtn = document.getElementById('loadDataBtn');
    const dataStatusBadge = document.getElementById('dataStatusBadge');
    const dataSpinner = document.getElementById('dataSpinner');
    const tableContainer = document.getElementById('tableContainer');
    const drawsTableBody = document.getElementById('drawsTableBody');
    const sliderContainer = document.getElementById('sliderContainer');
    const drawCountSlider = document.getElementById('drawCountSlider');
    const sliderValue = document.getElementById('sliderValue');
    const addManualBtn = document.getElementById('addManualBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const warningMsg = document.getElementById('warningMsg');
    
    const apiKeyInput = document.getElementById('apiKey');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');

    let allDraws = []; // Guardará todos los sorteos válidos disponibles

    // --- Events ---
    
    // Validar input de API Key para habilitar botón
    apiKeyInput.addEventListener('input', () => {
        analyzeBtn.disabled = apiKeyInput.value.trim().length === 0;
    });

    // Cargar datos reales NY Data
    const loadBtn = document.querySelector('#loadDataBtn');
    if(loadBtn) {
        loadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("¡BOTÓN PRESIONADO! Iniciando el evento click...");
            alert("¡Botón presionado! Verificando conexión a data.ny.gov...");
            try {
                await loadRealData();
            } catch (err) {
                console.error(err);
                alert("Error crítico al intentar cargar: " + err.message);
                showDataLoading(false);
            }
        });
    } else {
        console.error("CRITICAL: El botón loadDataBtn no existe en el DOM al arrancar app.js");
    }

    // Slider
    drawCountSlider.addEventListener('input', (e) => {
        sliderValue.textContent = e.target.value;
    });

    // Añadir sorteo manual
    addManualBtn.addEventListener('click', () => {
        addDrawRowToTable();
        tableContainer.scrollTop = tableContainer.scrollHeight;
        updateVisibility();
    });

    // Limpiar todo
    clearAllBtn.addEventListener('click', () => {
        allDraws = [];
        drawsTableBody.innerHTML = '';
        updateVisibility();
        dataStatusBadge.className = 'badge';
        dataStatusBadge.textContent = 'Sin datos';
    });

    // Analizar
    analyzeBtn.addEventListener('click', handleAnalysis);

    // --- Functions ---

    async function loadRealData() {
        console.log("Iniciando carga de datos (API Socrata)...");
        showDataLoading(true);
        dataStatusBadge.className = 'badge';
        dataStatusBadge.textContent = 'Obteniendo, por favor espere...';

        const URL_PRINCIPAL = 'https://data.ny.gov/resource/d6yy-54nr.json?$limit=200&$order=draw_date+DESC';
        const URL_PROXY = 'https://corsproxy.io/?' + encodeURIComponent(URL_PRINCIPAL);

        try {
            let res = await fetch(URL_PRINCIPAL);
            if (!res.ok) throw new Error('Respuesta de red no válida');
            const data = await res.json();
            
            parseSocrataData(data);
            finalizeLoad(true);

        } catch (error) {
            console.warn("Fallo fetch directo, intentando proxy...", error);
            try {
                let res = await fetch(URL_PROXY);
                if (!res.ok) throw new Error('Proxy falló');
                
                const data = await res.json();
                
                parseSocrataData(data);
                finalizeLoad(true);
            } catch (proxyError) {
                console.error("Fallo fetch proxy:", proxyError);
                finalizeLoad(false);
            }
        }
    }

    function finalizeLoad(success) {
        showDataLoading(false);
        if (success && allDraws.length > 0) {
            dataStatusBadge.className = 'badge success';
            dataStatusBadge.textContent = `✅ ${allDraws.length} sorteos cargados desde data.ny.gov`;
            renderTable();
        } else {
            dataStatusBadge.className = 'badge error';
            dataStatusBadge.textContent = `❌ Error al cargar. Usa el modo manual.`;
            if(allDraws.length === 0) {
                for(let i=0; i<3; i++) addDrawRowToTable();
            }
        }
        updateVisibility();
    }

    function parseSocrataData(data) {
        if(!Array.isArray(data)) return;
        
        allDraws = [];
        
        data.forEach(item => {
            if(!item.winning_numbers || !item.draw_date) return;
            
            const nums = item.winning_numbers.trim().split(/\s+/).map(Number);
            
            // Validamos que sean 6 números y que no haya NaNs
            if(nums.length >= 6 && !nums.some(isNaN)) {
                // Validación estricta de lotería: Blancas (1-69), PB (1-26)
                const blancas = nums.slice(0, 5);
                const pb = nums[5];
                
                if (blancas.every(n => n >= 1 && n <= 69) && pb >= 1 && pb <= 26) {
                    allDraws.push({
                        fecha: item.draw_date.substring(0, 10), // ej: "2025-04-12"
                        blancas: blancas,
                        powerball: pb
                    });
                }
            }
        });
    }

    function renderTable() {
        drawsTableBody.innerHTML = '';
        allDraws.forEach(d => {
            addDrawRowToTable(d.fecha, d.blancas, d.powerball);
        });
        
        // Adjust slider max
        const count = allDraws.length;
        if(count > 0) {
            drawCountSlider.max = Math.max(count, 20);
            drawCountSlider.value = Math.min(100, count);
            sliderValue.textContent = drawCountSlider.value;
        }
    }

    function addDrawRowToTable(fecha = 'Manual', blancas = ['', '', '', '', ''], powerball = '') {
        const tr = document.createElement('tr');
        
        let html = `<td>${fecha}</td><td>`;
        for(let i=0; i<5; i++) {
            html += `<input type="number" class="w-input" min="1" max="69" value="${blancas[i]}" required>`;
        }
        html += `</td><td><input type="number" class="pb-input" min="1" max="26" value="${powerball}" required></td>`;
        html += `<td><button class="remove-btn" title="Eliminar">✖</button></td>`;
        
        tr.innerHTML = html;
        
        tr.querySelector('.remove-btn').addEventListener('click', () => {
            tr.remove();
            updateVisibility();
        });
        
        drawsTableBody.appendChild(tr);
    }

    function showDataLoading(isLoading) {
        if(isLoading) {
            dataSpinner.classList.remove('hidden');
            loadDataBtn.disabled = true;
        } else {
            dataSpinner.classList.add('hidden');
            loadDataBtn.disabled = false;
        }
    }

    function updateVisibility() {
        const count = drawsTableBody.children.length;
        if(count > 0) {
            tableContainer.classList.remove('hidden');
            sliderContainer.classList.remove('hidden');
        } else {
            tableContainer.classList.add('hidden');
            sliderContainer.classList.add('hidden');
        }

        if(count > 0 && count < 20) {
            warningMsg.classList.remove('hidden');
        } else {
            warningMsg.classList.add('hidden');
        }
    }

    // --- IA Analysis Logic ---

    async function handleAnalysis() {
        const apiKey = apiKeyInput.value.trim();
        
        // Recopilar datos actuales de la tabla (por si el usuario editó o añadió manuales)
        const rows = document.querySelectorAll('#drawsTableBody tr');
        let currentDraws = [];
        let isValid = true;
        
        rows.forEach(row => {
            const wInputs = row.querySelectorAll('.w-input');
            const pbInput = row.querySelector('.pb-input');
            
            const blancas = Array.from(wInputs).map(inp => parseInt(inp.value));
            const pb = parseInt(pbInput.value);
            
            if(blancas.some(isNaN) || isNaN(pb)) isValid = false;
            
            currentDraws.push({ blancas, powerball: pb });
        });

        if(!isValid || currentDraws.length === 0) {
            alert('Por favor verifica que todos los campos de números estén completos y válidos.');
            return;
        }

        // Limitar por slider si hay suficientes
        const numToUse = parseInt(drawCountSlider.value);
        if(currentDraws.length > numToUse) {
            // Tomamos los primeros "numToUse" (que asumen estar más recientes)
            currentDraws = currentDraws.slice(0, numToUse);
        }

        startLoading();

        try {
            const stats = calculateStats(currentDraws);
            const result = await analizarConIA(stats, apiKey);
            renderResult(result, stats);
        } catch (error) {
            console.error(error);
            alert('Error en el análisis de IA: ' + error.message);
            resetLoading();
        }
    }

    function calculateStats(draws) {
        let whiteFreq = {};
        let pbFreq = {};
        let totalSum = 0;
        let totalEvens = 0;
        let totalWhiteBalls = draws.length * 5;
        let gapSums = 0;

        draws.forEach(d => {
            d.blancas.forEach(w => {
                whiteFreq[w] = (whiteFreq[w] || 0) + 1;
                totalSum += w;
                if(w % 2 === 0) totalEvens++;
            });
            pbFreq[d.powerball] = (pbFreq[d.powerball] || 0) + 1;
            
            let sortedW = [...d.blancas].sort((a,b) => a-b);
            for(let i=1; i<5; i++) {
                gapSums += (sortedW[i] - sortedW[i-1]);
            }
        });

        const sortFreq = (freqObj) => Object.entries(freqObj).sort((a,b) => b[1] - a[1]);
        
        const sortedWhites = sortFreq(whiteFreq);
        const sortedPBs = sortFreq(pbFreq);

        // Sorteos transcurridos desde la última aparición de cada número (draws[0] = más reciente)
        const atrasados = [];
        for (let n = 1; n <= 69; n++) {
            const idx = draws.findIndex(d => d.blancas.includes(n));
            atrasados.push({ num: n, sorteos_sin_salir: idx === -1 ? draws.length : idx });
        }
        atrasados.sort((a, b) => b.sorteos_sin_salir - a.sorteos_sin_salir || a.num - b.num);

        const rangos = { bajo_1_23: 0, medio_24_46: 0, alto_47_69: 0 };
        const sumas = [];
        let primos = 0;
        const PRIMOS = new Set([2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67]);
        draws.forEach(d => {
            sumas.push(d.blancas.reduce((s, w) => s + w, 0));
            d.blancas.forEach(w => {
                if (w <= 23) rangos.bajo_1_23++;
                else if (w <= 46) rangos.medio_24_46++;
                else rangos.alto_47_69++;
                if (PRIMOS.has(w)) primos++;
            });
        });
        const pct = v => `${Math.round((v / totalWhiteBalls) * 100)}%`;

        // Cada bola blanca ~ Binomial(n = sorteos * 5 bolas, p = 1/69) bajo la hipótesis de azar puro.
        const esperado = totalWhiteBalls / 69;
        const desvio = Math.sqrt(totalWhiteBalls * (1 / 69) * (68 / 69));
        const zScore = veces => +((veces - esperado) / desvio).toFixed(2);

        // Chi-cuadrado de bondad de ajuste a la uniforme sobre los 69 números (gl = 68, crítico 95% = 88.25).
        let chi = 0;
        for (let n = 1; n <= 69; n++) chi += Math.pow((whiteFreq[n] || 0) - esperado, 2) / esperado;
        const chiCuadrado = {
            valor: +chi.toFixed(1),
            grados_libertad: 68,
            critico_95: 88.25,
            rechaza_uniformidad: chi > 88.25
        };

        return {
            total_analizados: draws.length,
            veces_esperada_por_numero_blanco: +((draws.length * 5) / 69).toFixed(1),
            ultimos_10: draws.slice(0, 10),
            atrasados_top_10: atrasados.slice(0, 10),
            distribucion_rangos: {
                bajo_1_23: pct(rangos.bajo_1_23),
                medio_24_46: pct(rangos.medio_24_46),
                alto_47_69: pct(rangos.alto_47_69)
            },
            suma_min: Math.min(...sumas),
            suma_max: Math.max(...sumas),
            primos_promedio_por_sorteo: +(primos / draws.length).toFixed(1),
            top_15_blancas: sortedWhites.slice(0, 15).map(x => ({ num: parseInt(x[0]), veces: x[1], z: zScore(x[1]) })),
            bottom_5_blancas: sortedWhites.slice(-5).map(x => ({ num: parseInt(x[0]), veces: x[1], z: zScore(x[1]) })),
            test_uniformidad_blancas: chiCuadrado,
            top_5_pb: sortedPBs.slice(0, 5).map(x => ({ num: parseInt(x[0]), veces: x[1] })),
            suma_promedio: Math.round(totalSum / draws.length),
            ratio_pares_impares: `${Math.round((totalEvens/totalWhiteBalls)*100)}% pares / ${Math.round(((totalWhiteBalls-totalEvens)/totalWhiteBalls)*100)}% impares`,
            gap_promedio: (gapSums / (draws.length * 4)).toFixed(1)
        };
    }

    // --- OpenRouter: selección de modelos gratuitos ---

    const OPENROUTER_URL = "https://openrouter.ai/api/v1";
    // Los modelos gratuitos que razonan pueden tardar ~2 min: timeout generoso por modelo y tope global.
    const TIMEOUT_MODELO_MS = 150000;
    const TIMEOUT_TOTAL_MS = 400000;
    const MAX_MODELOS = 6;

    // "openrouter/free" enruta solo hacia un modelo gratuito disponible; los demás son respaldo
    // por si el listado dinámico falla. Los IDs viejos (deepseek-r1:free, etc.) ya no existen.
    const MODELOS_RESPALDO = [
        "openrouter/free",
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free"
    ];

    // Modelos que no sirven para esta tarea (seguridad, visión, audio, código, etc.)
    const MODELOS_EXCLUIDOS = /safety|guard|lyria|embed|image|audio|tts|whisper|-vl\b|omni|code|coder|stealth|tiny|nano|lfm/i;
    const MODELOS_PREFERIDOS = /gemma|nemotron|llama|qwen|deepseek|mistral|gpt-oss|glm/i;

    let modelosCache = null;

    // Consulta la lista pública de OpenRouter y devuelve los modelos gratuitos de texto vigentes.
    async function obtenerModelosGratis() {
        if (modelosCache) return modelosCache;

        let dinamicos = [];
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 15000);
            const res = await fetch(`${OPENROUTER_URL}/models`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (res.ok) {
                const { data } = await res.json();
                dinamicos = (data || [])
                    .filter(m => {
                        const p = m.pricing || {};
                        const gratis = Number(p.prompt) === 0 && Number(p.completion) === 0;
                        const salida = m.architecture?.output_modalities;
                        const soloTexto = !salida || (salida.length === 1 && salida[0] === "text");
                        return gratis && soloTexto
                            && m.id.endsWith(":free")
                            && (m.context_length || 0) >= 32000
                            && !MODELOS_EXCLUIDOS.test(m.id);
                    })
                    .sort((a, b) =>
                        (MODELOS_PREFERIDOS.test(b.id) - MODELOS_PREFERIDOS.test(a.id)) ||
                        ((b.context_length || 0) - (a.context_length || 0)))
                    .map(m => m.id);
            }
        } catch (e) {
            console.warn("No se pudo listar modelos de OpenRouter, uso la lista de respaldo:", e.message);
        }

        // openrouter/free primero (auto-enrutador), luego el listado vivo, luego el respaldo.
        modelosCache = [...new Set(["openrouter/free", ...dinamicos, ...MODELOS_RESPALDO])].slice(0, MAX_MODELOS);
        return modelosCache;
    }

    // Errores que no se arreglan cambiando de modelo: se cortan de inmediato.
    class ErrorFatal extends Error {}

    async function llamarIA(systemPrompt, userMessage, apiKey) {
        const loadingText = document.querySelector('#loadingSection p');
        const modelos = await obtenerModelosGratis();
        const fallos = [];
        const limite = Date.now() + TIMEOUT_TOTAL_MS;

        for (const modelo of modelos) {
            if (Date.now() > limite) { fallos.push('tiempo total agotado'); break; }
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MODELO_MS);
            try {
                if (loadingText) loadingText.textContent = `Consultando modelo gratuito (${modelo})... puede tardar 1-3 min`;

                const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
                    method: "POST",
                    signal: ctrl.signal,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": location.origin && location.origin !== "null" ? location.origin : "http://localhost",
                        "X-Title": "Powerball Oracle"
                    },
                    body: JSON.stringify({
                        model: modelo,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userMessage }
                        ],
                        temperature: 0.4,
                        // Los modelos que razonan gastan miles de tokens "pensando" antes de escribir el JSON;
                        // con un tope bajo (6000) se quedan sin contenido (finish_reason: length).
                        max_tokens: 16000,
                        reasoning: { exclude: true }
                    })
                });

                const data = await response.json().catch(() => ({}));

                if (response.status === 401) {
                    throw new ErrorFatal("API Key inválida. Verifica tu key en openrouter.ai/keys");
                }
                if (response.status === 402) {
                    throw new ErrorFatal("Sin créditos o límite de cuenta alcanzado. Revisa openrouter.ai/credits");
                }

                // 429 (límite del proveedor), 404, 5xx, etc. afectan a ESTE modelo: se prueba el siguiente.
                if (!response.ok || data.error) {
                    const detalle = data?.error?.message || `HTTP ${response.status}`;
                    throw new Error(detalle);
                }

                const eleccion = data.choices?.[0];
                if (eleccion?.finish_reason === "length") throw new Error("se agotaron los tokens razonando");
                const texto = (eleccion?.message?.content || "")
                    .replace(/<think>[\s\S]*?<\/think>/gi, "")
                    .trim();
                if (!texto) throw new Error("respuesta vacía");

                console.log(`✅ Respondió el modelo: ${data.model || modelo}`);
                return texto;

            } catch (e) {
                if (e instanceof ErrorFatal) throw e;
                const motivo = e.name === "AbortError" ? "tiempo de espera agotado" : e.message;
                console.warn(`Modelo ${modelo} falló (${motivo}), probando siguiente...`);
                fallos.push(`${modelo}: ${motivo}`);
            } finally {
                clearTimeout(timer);
            }
        }

        throw new Error(
            "Ningún modelo gratuito respondió en este momento (suelen saturarse). " +
            "Espera un minuto y reintenta.\n\n" + fallos.join("\n")
        );
    }

    // Extrae el primer objeto JSON del texto, tolerando markdown y texto alrededor.
    function extraerJSON(texto) {
        const limpio = texto.replace(/```(?:json)?/gi, "").trim();
        const inicio = limpio.indexOf("{");
        const fin = limpio.lastIndexOf("}");
        if (inicio === -1 || fin <= inicio) throw new Error("No se encontró JSON en la respuesta");
        return JSON.parse(limpio.slice(inicio, fin + 1));
    }

    // Valida y normaliza la respuesta para que renderResult nunca reciba datos inválidos.
    function validarRespuesta(obj) {
        const p = obj?.prediccion;
        const a = obj?.analisis || {};
        if (!p) throw new Error("Falta el objeto 'prediccion'");

        const blancos = (p.numeros_blancos || []).map(Number);
        const pb = Number(p.powerball);
        if (blancos.length !== 5 || new Set(blancos).size !== 5 ||
            blancos.some(n => !Number.isInteger(n) || n < 1 || n > 69)) {
            throw new Error("Los números blancos deben ser 5 enteros distintos entre 1 y 69");
        }
        if (!Number.isInteger(pb) || pb < 1 || pb > 26) {
            throw new Error("El Powerball debe ser un entero entre 1 y 26");
        }

        const numeros = arr => (Array.isArray(arr) ? arr : []).map(Number)
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 69);
        const texto = (v, def = "—") => (typeof v === "string" && v.trim()) ? v.trim() : def;

        return {
            prediccion: {
                numeros_blancos: blancos.sort((x, y) => x - y),
                powerball: pb,
                confianza: texto(p.confianza, "Baja"),
                frase_resumen: texto(p.frase_resumen)
            },
            analisis: {
                patrones_encontrados: (Array.isArray(a.patrones_encontrados) ? a.patrones_encontrados : [])
                    .map(String),
                numeros_calientes: numeros(a.numeros_calientes),
                numeros_frios: numeros(a.numeros_frios),
                suma_promedio: Number.isFinite(Number(a.suma_promedio)) ? Math.round(Number(a.suma_promedio)) : "—",
                tendencia_paridad: texto(a.tendencia_paridad),
                rango_dominante: texto(a.rango_dominante),
                relacion_powerball: texto(a.relacion_powerball),
                tendencia_reciente: texto(a.tendencia_reciente),
                razonamiento_prediccion: texto(a.razonamiento_prediccion)
            }
        };
    }

    async function analizarConIA(stats, apiKey) {
        const systemPrompt = `ROL
Eres un estadístico senior especializado en loterías de números (Powerball: 5 bolas blancas de 1 a 69 sin reposición + 1 Powerball de 1 a 26). Tienes más de 15 años de experiencia en análisis de distribuciones discretas, pruebas de hipótesis y modelado de combinaciones. Trabajas con rigor metodológico y comunicas con precisión: nunca exageras la evidencia.

MARCO TEÓRICO (obligatorio)
- Hipótesis nula H0: cada sorteo es independiente y uniforme. Bajo H0, cada número blanco sigue una Binomial(n = sorteos × 5, p = 1/69) y el Powerball una uniforme sobre 1-26.
- Un z-score con |z| < 2 NO es estadísticamente significativo; entre 2 y 3 es una desviación moderada; |z| > 3 es notable (con ~69 números es esperable que 1 o 2 superen |z| = 2 solo por azar).
- test_uniformidad_blancas es un chi-cuadrado de bondad de ajuste (gl = 68, crítico 95% = 88.25). Si "rechaza_uniformidad" es false, NO hay evidencia de sesgo en la frecuencia y debes decirlo explícitamente.
- Falacia del jugador: que un número lleve muchos sorteos sin salir NO aumenta su probabilidad real. Puedes usar el atraso como criterio de diversificación, pero nunca como causa; decláralo así.
- No afirmes causalidad ni certeza. Cuantifica siempre la incertidumbre.

DATOS DE ENTRADA
Recibirás un JSON con: total_analizados, veces_esperada_por_numero_blanco, ultimos_10 (del más reciente al más antiguo), atrasados_top_10 (sorteos sin salir), top_15_blancas y bottom_5_blancas (con veces y z), test_uniformidad_blancas, distribucion_rangos (bajo 1-23, medio 24-46, alto 47-69), suma_promedio, suma_min, suma_max, ratio_pares_impares, gap_promedio, primos_promedio_por_sorteo y top_5_pb. Usa únicamente estas cifras; nunca inventes datos ni cites números que no estén en el resumen.

PROCEDIMIENTO (síguelo en orden)
1. Contraste global: interpreta test_uniformidad_blancas y concluye si hay o no evidencia de sesgo en la frecuencia.
2. Frecuencias: identifica los números con |z| ≥ 2 (si los hay) y trátalos como "calientes" o "fríos" estadísticamente relevantes; si ninguno lo es, di que las diferencias son ruido muestral y elige calientes/fríos por orden de frecuencia como criterio descriptivo.
3. Estructura de la combinación: compara suma, paridad, distribución por rangos, gap_promedio y primos con sus valores históricos. Las combinaciones reales tienden a concentrarse cerca de la media en suma y a repartirse entre 2-3 rangos y 2-3 pares; úsalo como criterio de coherencia estructural, no como predicción.
4. Dinámica reciente: contrasta ultimos_10 con el histórico (rango dominante, paridad, suma) e indica si el cambio es relevante o está dentro de la variación esperable con 10 sorteos.
5. Powerball: evalúa top_5_pb frente a la frecuencia esperada (sorteos/26) y decide con el mismo criterio de significancia.
6. Síntesis: construye UNA combinación que (a) incluya 2-3 números con mayor frecuencia relativa, (b) 1-2 números de alto atraso como diversificación, (c) complete con números que equilibren suma (cerca de suma_promedio), paridad (2-3 pares) y rangos (al menos dos representados), y (d) no repita exactamente ningún sorteo de ultimos_10.
7. Auditoría: antes de responder verifica cada regla de la sección siguiente.

REGLAS DE SALIDA
- numeros_blancos: exactamente 5 enteros DISTINTOS entre 1 y 69, en orden ascendente.
- powerball: entero entre 1 y 26.
- numeros_calientes: 8 enteros de 1 a 69 (ordenados de mayor a menor frecuencia, tomados de top_15_blancas). numeros_frios: 5 enteros de 1 a 69 (tomados de bottom_5_blancas o atrasados_top_10).
- confianza: solo "Media" o "Baja", nunca "Alta". Usa "Media" solo si hay evidencia estadística real (rechaza_uniformidad = true o varios |z| ≥ 2); en cualquier otro caso usa "Baja".
- patrones_encontrados: 3 a 5 strings breves, cada uno con una cifra concreta del resumen (frecuencia, z, atraso, porcentaje, etc.) y su lectura estadística.
- tendencia_paridad, rango_dominante, relacion_powerball y tendencia_reciente: 1-2 oraciones con cifras del resumen.
- razonamiento_prediccion: 5 a 7 oraciones. Debe (1) justificar cada uno de los 5 números y el Powerball, (2) indicar el resultado del contraste de uniformidad, (3) reconocer explícitamente que la selección es un ejercicio descriptivo y que la probabilidad de cada combinación es idéntica bajo H0 (1 en 292.201.338).
- frase_resumen: una sola oración, concisa y sin promesas de acierto.
- Todo el texto en español, tono técnico y sobrio.

FORMATO
Responde ÚNICAMENTE con un objeto JSON válido: sin markdown, sin bloques de código, sin comentarios, sin comas finales y sin texto antes o después.
{
  "prediccion": {
    "numeros_blancos": [0, 0, 0, 0, 0],
    "powerball": 0,
    "confianza": "Media | Baja",
    "frase_resumen": "string"
  },
  "analisis": {
    "patrones_encontrados": ["string"],
    "numeros_calientes": [0, 0, 0, 0, 0, 0, 0, 0],
    "numeros_frios": [0, 0, 0, 0, 0],
    "suma_promedio": 0,
    "tendencia_paridad": "string",
    "rango_dominante": "string",
    "relacion_powerball": "string",
    "tendencia_reciente": "string",
    "razonamiento_prediccion": "string"
  }
}`;

        const promptMessage = `Resumen estadístico (ultimos_10 está ordenado del sorteo más reciente al más antiguo):\n${JSON.stringify(stats, null, 2)}`;

        const MAX_INTENTOS = 2;
        let ultimoError = null;

        for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
            const texto = await llamarIA(systemPrompt, promptMessage, apiKey);
            try {
                return validarRespuesta(extraerJSON(texto));
            } catch (e) {
                // El modelo respondió, pero con un JSON roto o inválido: se reintenta (otro modelo/otra muestra).
                ultimoError = e;
                console.warn(`Respuesta inválida (intento ${intento}/${MAX_INTENTOS}):`, e.message);
            }
        }

        throw new Error(`El modelo devolvió una respuesta inválida (${ultimoError.message}). Intenta de nuevo.`);
    }

    function startLoading() {
        resultSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "ANALIZANDO...";
    }

    function resetLoading() {
        loadingSection.classList.add('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "ANALIZAR Y PREDECIR";
    }

    function renderResult(data, localStats) {
        resetLoading();
        resultSection.classList.remove('hidden');

        const p = data.prediccion;
        const a = data.analisis;

        document.getElementById('summaryPhrase').textContent = p.frase_resumen;
        
        const badge = document.getElementById('confidenceBadge');
        badge.textContent = 'Confianza: ' + p.confianza;
        if(p.confianza.toLowerCase().includes('alta')) {
            badge.style.color = '#55ff55';
            badge.style.boxShadow = '0 0 10px rgba(85, 255, 85, 0.3)';
        } else if(p.confianza.toLowerCase().includes('baja')) {
            badge.style.color = '#ff5555';
            badge.style.boxShadow = '0 0 10px rgba(255, 85, 85, 0.3)';
        } else {
            badge.style.color = '#FFD700';
            badge.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
        }

        // Bolas animadas
        const ballsContainer = document.getElementById('predictionBalls');
        ballsContainer.innerHTML = '';
        
        p.numeros_blancos.forEach((num, index) => {
            const b = document.createElement('div');
            b.className = 'ball white';
            b.textContent = num;
            b.style.animationDelay = `${index * 0.15}s`;
            ballsContainer.appendChild(b);
        });

        const pb = document.createElement('div');
        pb.className = 'ball red';
        pb.textContent = p.powerball;
        pb.style.animationDelay = `${p.numeros_blancos.length * 0.15}s`;
        ballsContainer.appendChild(pb);

        // Análisis Details
        const patternsList = document.getElementById('patternsList');
        patternsList.innerHTML = '';
        a.patrones_encontrados.forEach(pat => {
            const li = document.createElement('li');
            li.textContent = `🔍 ${pat}`; // textContent: el texto viene del modelo, no se interpreta como HTML
            patternsList.appendChild(li);
        });
        
        // Freq Bars
        renderFreqBars('hotNumbersList', a.numeros_calientes, localStats.top_15_blancas, true);
        renderFreqBars('coldNumbersList', a.numeros_frios, localStats.bottom_5_blancas, false);

        document.getElementById('avgSum').textContent = a.suma_promedio;
        document.getElementById('parityTrend').textContent = a.tendencia_paridad;
        document.getElementById('rangoDominante').textContent = a.rango_dominante;
        document.getElementById('tendenciaReciente').textContent = a.tendencia_reciente;
        document.getElementById('pbRelation').textContent = a.relacion_powerball;
        document.getElementById('reasoningText').textContent = a.razonamiento_prediccion;
        
        // Auto-scroll
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderFreqBars(containerId, numbersArr, statsRef, isHot) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        // Encontrar max veces para escalar
        let maxVeces = statsRef.reduce((max, item) => item.veces > max ? item.veces : max, 1);
        if(!isHot && maxVeces < 5) maxVeces = 5; // offset visual para frios

        numbersArr.forEach(num => {
            // Buscar cuántas veces apareció según las stats locales
            let statItem = statsRef.find(s => s.num === num);
            let count = statItem ? statItem.veces : 0;
            let percent = (count / maxVeces) * 100;
            if(!isHot && percent === 0) percent = 5; // Mínimo visual

            const item = document.createElement('div');
            item.className = 'freq-item';
            item.innerHTML = `
                <span class="num">${num}</span>
                <div class="freq-bar-bg">
                    <div class="freq-bar-fill" style="width: ${percent}%"></div>
                </div>
                <span class="count">${count}x</span>
            `;
            container.appendChild(item);
        });
    }
});