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

        return {
            total_analizados: draws.length,
            ultimos_10: draws.slice(0, 10),
            top_15_blancas: sortedWhites.slice(0, 15).map(x => ({ num: parseInt(x[0]), veces: x[1] })),
            bottom_5_blancas: sortedWhites.slice(-5).map(x => ({ num: parseInt(x[0]), veces: x[1] })),
            top_5_pb: sortedPBs.slice(0, 5).map(x => ({ num: parseInt(x[0]), veces: x[1] })),
            suma_promedio: Math.round(totalSum / draws.length),
            ratio_pares_impares: `${Math.round((totalEvens/totalWhiteBalls)*100)}% pares / ${Math.round(((totalWhiteBalls-totalEvens)/totalWhiteBalls)*100)}% impares`,
            gap_promedio: (gapSums / (draws.length * 4)).toFixed(1)
        };
    }

    const MODELOS_GRATIS = [
        "openrouter/free",
        "deepseek/deepseek-r1:free",
        "deepseek/deepseek-v3:free", 
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free"
    ];

    async function llamarIA(systemPrompt, userMessage, apiKey) {
        let ultimoError = null;
        const loadingText = document.querySelector('#loadingSection p');

        for (const modelo of MODELOS_GRATIS) {
            try {
                if (loadingText) loadingText.textContent = `Buscando modelo disponible (${modelo})...`;
                
                const response = await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`,
                            "HTTP-Referer": "http://localhost",
                            "X-Title": "Powerball Oracle"
                        },
                        body: JSON.stringify({
                            model: modelo,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userMessage }
                            ],
                            temperature: 0.7,
                            max_tokens: 1500
                        })
                    }
                );

                // Si el modelo no existe o no está disponible, probar el siguiente
                if (response.status === 404 || response.status === 503) {
                    console.warn(`Modelo ${modelo} no disponible, probando siguiente...`);
                    continue;
                }

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    const codigo = response.status;
                    const mensaje = error?.error?.message || "Error desconocido";

                    if (codigo === 401) {
                        throw new Error("API Key inválida. Verifica tu key en openrouter.ai/keys");
                    } else if (codigo === 429) {
                        throw new Error("Demasiadas solicitudes. Espera 30 segundos y reintenta.");
                    } else if (codigo === 402) {
                        throw new Error("Sin créditos. Verifica tu cuenta en openrouter.ai");
                    } else {
                        throw new Error(`Error ${codigo}: ${mensaje}`);
                    }
                }

                if (loadingText) loadingText.textContent = `Analizando con IA (${modelo})...`;
                const data = await response.json();

                if (
                    !data.choices ||
                    data.choices.length === 0 ||
                    !data.choices[0].message?.content
                ) {
                    console.warn(`Modelo ${modelo} no devolvió contenido, probando siguiente...`);
                    continue;
                }

                // Limpiar tags <think> de modelos de razonamiento como DeepSeek R1
                let texto = data.choices[0].message.content;
                texto = texto.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

                // Mostrar en consola qué modelo respondió
                console.log(`✅ Respondió el modelo: ${modelo}`);
                return texto;

            } catch (e) {
                // Si es error de red o 404, continuar con el siguiente modelo
                if (e.message.includes("inválida") || 
                    e.message.includes("créditos") || 
                    e.message.includes("solicitudes")) {
                    throw e; // Estos errores no se pueden resolver cambiando de modelo
                }
                ultimoError = e;
                console.warn(`Error con ${modelo}:`, e.message);
                continue;
            }
        }

        // Si ningún modelo funcionó
        throw new Error(
            "Ningún modelo gratuito está disponible en este momento. " +
            "Intenta de nuevo en unos minutos."
        );
    }

    async function analizarConIA(stats, apiKey) {
        const systemPrompt = `Eres un experto analista matemático de lotería. Se te entregará un resumen estadístico pre-calculado de los últimos sorteos de Powerball.
Analiza estas estadísticas buscando patrones: frecuencias, sumas, paridad, gaps, rangos dominantes (1-23, 24-46, 47-69), números primos, y tendencias de los últimos 10 sorteos vs el histórico general.
Basándote EXCLUSIVAMENTE en tu análisis lógico de estos datos, da UNA predicción concreta y definitiva.

DEBES RESPONDER EXCLUSIVAMENTE CON ESTE JSON VÁLIDO (SIN MARKDOWN):
{
  "prediccion": {
    "numeros_blancos": [n1, n2, n3, n4, n5],
    "powerball": n,
    "confianza": "Alta / Media / Baja",
    "frase_resumen": "Oración central de la lógica"
  },
  "analisis": {
    "patrones_encontrados": ["patrón 1", "patrón 2"],
    "numeros_calientes": [n1, n2, n3, n4, n5, n6, n7, n8],
    "numeros_frios": [n1, n2, n3, n4, n5],
    "suma_promedio": número_entero,
    "tendencia_paridad": "texto descriptivo",
    "rango_dominante": "texto sobre rangos (bajo/medio/alto)",
    "relacion_powerball": "texto descriptivo",
    "tendencia_reciente": "texto analizando últimos 10 sorteos",
    "razonamiento_prediccion": "Explicación detallada (4-6 oraciones) de POR QUÉ se eligieron basándose en patrones"
  }
}`;

        const promptMessage = `Resumen Estadístico:\n${JSON.stringify(stats, null, 2)}`;

        let intentos = 0;
        const MAX_INTENTOS = 2;

        while (intentos < MAX_INTENTOS) {
            try {
                const texto = await llamarIA(systemPrompt, promptMessage, apiKey);
                
                // Limpiar bloques markdown
                const limpio = texto
                    .replace(/```json/gi, "")
                    .replace(/```/g, "")
                    .trim();

                // Extraer solo el JSON si hay texto extra alrededor
                const matchJSON = limpio.match(/\{[\s\S]*\}/);
                if (!matchJSON) throw new Error("No se encontró JSON en la respuesta");
                
                return JSON.parse(matchJSON[0]);

            } catch (e) {
                intentos++;
                if (intentos >= MAX_INTENTOS) {
                    throw new Error(
                        "No se pudo obtener una respuesta válida después de 2 intentos. " +
                        "Intenta de nuevo."
                    );
                }
                // Esperar 3 segundos antes de reintentar
                await new Promise(r => setTimeout(r, 3000));
            }
        }
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
        patternsList.innerHTML = a.patrones_encontrados.map(pat => `<li>🔍 ${pat}</li>`).join('');
        
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