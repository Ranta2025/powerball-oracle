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
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');

    let allDraws = []; // Guardará todos los sorteos válidos disponibles

    // --- Events ---
    
    // Cargar datos reales NY Data
    const loadBtn = document.querySelector('#loadDataBtn');
    if(loadBtn) {
        loadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
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

        // Formato actual (5 de 69 + Powerball de 26) vigente desde el 7 de octubre de 2015
        const URL_PRINCIPAL = "https://data.ny.gov/resource/d6yy-54nr.json?$limit=3000&$order=draw_date+DESC&$where=draw_date>='2015-10-07T00:00:00'";
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
                
                const fecha = item.draw_date.substring(0, 10);
                if (fecha >= '2015-10-07' && blancas.every(n => n >= 1 && n <= 69) && pb >= 1 && pb <= 26) {
                    allDraws.push({
                        fecha: fecha, // ej: "2025-04-12"
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
            drawCountSlider.value = Math.min(300, count);
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
        analyzeBtn.disabled = count === 0;
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

    // --- Análisis Estadístico Local ---

    function handleAnalysis() {
        // Recopilar datos actuales de la tabla (por si el usuario editó o añadió manuales)
        const rows = document.querySelectorAll('#drawsTableBody tr');
        const currentDraws = [];
        let isValid = true;

        rows.forEach(row => {
            const blancas = Array.from(row.querySelectorAll('.w-input')).map(inp => parseInt(inp.value));
            const pb = parseInt(row.querySelector('.pb-input').value);

            if (blancas.some(n => isNaN(n) || n < 1 || n > 69) || new Set(blancas).size !== 5 ||
                isNaN(pb) || pb < 1 || pb > 26) {
                isValid = false;
            }
            currentDraws.push({ blancas, powerball: pb });
        });

        if (!isValid || currentDraws.length === 0) {
            alert('Verifica que cada sorteo tenga 5 bolas blancas distintas (1-69) y un Powerball (1-26).');
            return;
        }

        const windowSize = Math.min(parseInt(drawCountSlider.value), currentDraws.length);

        startLoading();
        // Dejar que el navegador pinte el spinner antes del cálculo
        setTimeout(() => {
            try {
                const result = OracleEngine.analyze(currentDraws, windowSize);
                renderResult(result);
            } catch (error) {
                console.error(error);
                alert('Error en el análisis: ' + error.message);
                resetLoading();
            }
        }, 50);
    }

    function startLoading() {
        resultSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "Analizando…";
    }

    function resetLoading() {
        loadingSection.classList.add('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analizar y predecir";
    }

    const pct = x => (x * 100).toFixed(1) + '%';

    function renderResult(r) {
        resetLoading();
        resultSection.classList.remove('hidden');

        const main = r.tickets[0];
        const d = r.desc;
        const bt = r.white.backtest;
        const btPb = r.pb.backtest;
        const uniformWeight = r.white.weights.find(w => w.id === 'uniforme').peso;
        const bestModel = [...r.white.weights].sort((a, b) => b.peso - a.peso)[0];
        const sesgo = r.chiWhite.pValue < 0.05;

        document.getElementById('summaryPhrase').textContent = uniformWeight > 0.5
            ? 'Los datos se comportan como azar puro: la jugada se optimizó por estructura estadística y para no compartir el premio.'
            : `El modelo con más evidencia es "${bestModel.nombre}" (${pct(bestModel.peso)} del peso).`;

        // Confianza basada en evidencia real, no en opinión
        const badge = document.getElementById('confidenceBadge');
        const ventaja = bt.aciertosModelo - bt.aciertosAzar;
        let nivel, color;
        if (sesgo && ventaja > 0.05 && uniformWeight < 0.5) { nivel = 'Media'; color = '#FFD700'; }
        else { nivel = 'Baja (el sorteo es aleatorio)'; color = '#ff5555'; }
        badge.textContent = 'Confianza: ' + nivel;
        badge.style.color = color;
        badge.style.boxShadow = `0 0 10px ${color}55`;

        // Bolas animadas
        const ballsContainer = document.getElementById('predictionBalls');
        ballsContainer.innerHTML = '';
        main.blancas.forEach((num, index) => {
            ballsContainer.appendChild(makeBall(num, 'white', index));
        });
        ballsContainer.appendChild(makeBall(main.powerball, 'red', main.blancas.length));

        // Patrones encontrados
        const pairsTxt = d.topPairs.map(([k, v]) => `${k.replace('-', ' y ')} (${v} veces)`).join(', ');
        const overdue = [];
        for (let n = 1; n <= 69; n++) overdue.push(n);
        overdue.sort((a, b) => d.gaps[b] - d.gaps[a]);
        const patrones = [
            `Test χ² de uniformidad (bolas blancas): χ²=${r.chiWhite.chi2.toFixed(1)}, gl=${r.chiWhite.df}, p=${r.chiWhite.pValue.toFixed(3)} → ` +
                (sesgo ? 'hay desviación significativa del azar (posible, pero puede ser casualidad).' : 'no hay evidencia de que algún número salga más de lo normal.'),
            `Test χ² Powerball: p=${r.chiPb.pValue.toFixed(3)} → ${r.chiPb.pValue < 0.05 ? 'desviación significativa.' : 'consistente con azar.'}`,
            `Números más atrasados: ${overdue.slice(0, 5).map(n => `${n} (${d.gaps[n]} sorteos)`).join(', ')}. Lo esperado es que un número salga cada ~13.8 sorteos.`,
            `Pares que más salieron juntos: ${pairsTxt} (lo esperado por azar es ${d.expectedPair.toFixed(1)} veces).`,
            `Se simularon 40,000 combinaciones (Monte Carlo) y se eligieron las de mejor puntuación.`
        ];
        document.getElementById('patternsList').innerHTML = patrones.map(t => `<li>🔍 ${t}</li>`).join('');

        // Calientes / fríos por z-score
        const nums = [];
        for (let n = 1; n <= 69; n++) nums.push(n);
        const byCount = [...nums].sort((a, b) => r.whiteCounts[b] - r.whiteCounts[a] || a - b);
        const maxCount = r.whiteCounts[byCount[0]] || 1;
        renderFreqBars('hotNumbersList', byCount.slice(0, 8), r.whiteCounts, d.zScores, maxCount);
        renderFreqBars('coldNumbersList', byCount.slice(-5).reverse(), r.whiteCounts, d.zScores, maxCount);

        document.getElementById('avgSum').textContent = `${d.sumaPromedio} (teórica ${r.constantes.SUM_MEAN} ± ${r.constantes.SUM_SD.toFixed(0)})`;
        document.getElementById('parityTrend').textContent = `${d.paresPct}% pares / ${100 - d.paresPct}% impares`;
        document.getElementById('rangoDominante').textContent = `1-23: ${d.rangos[0]}% · 24-46: ${d.rangos[1]}% · 47-69: ${d.rangos[2]}%`;
        document.getElementById('tendenciaReciente').textContent =
            `Suma promedio de los últimos 10 sorteos: ${d.sumaReciente} vs ${d.sumaPromedio} en los ${r.ventana} analizados. ` +
            `Cada sorteo es independiente, así que esta tendencia no cambia las probabilidades del próximo.`;

        const pbSorted = [];
        for (let n = 1; n <= 26; n++) pbSorted.push(n);
        pbSorted.sort((a, b) => r.pbCounts[b] - r.pbCounts[a]);
        document.getElementById('pbRelation').textContent =
            `Powerball más frecuentes: ${pbSorted.slice(0, 5).map(n => `${n} (${r.pbCounts[n]}x)`).join(', ')}. ` +
            `Elegido: ${main.powerball}. Probabilidad real de acertar el Powerball: 1 en 26 (3.8%).`;

        // Pesos de modelos
        const mw = document.getElementById('modelWeights');
        mw.innerHTML = '';
        r.white.weights.forEach(w => {
            mw.appendChild(freqItem(pct(w.peso), w.peso * 100, w.nombre));
        });

        document.getElementById('backtestText').textContent =
            `Se "predijeron" los últimos ${bt.pasos} sorteos usando solo datos anteriores a cada uno. ` +
            `Bolas blancas acertadas por sorteo: modelo ${bt.aciertosModelo.toFixed(3)} vs azar ${bt.aciertosAzar.toFixed(3)}. ` +
            `Powerball acertado: modelo ${pct(btPb.aciertosModelo)} vs azar ${pct(btPb.aciertosAzar)}. ` +
            (Math.abs(ventaja) < 0.05 ? 'Resultado: el modelo rinde igual que el azar, como predice la teoría.' :
                ventaja > 0 ? 'El modelo supera levemente al azar en esta muestra (probablemente suerte estadística).' :
                    'El modelo rinde algo peor que el azar en esta muestra (variación normal).');

        // Jugadas alternativas
        const alt = document.getElementById('altTickets');
        alt.innerHTML = '';
        r.tickets.slice(1).forEach(t => {
            const row = document.createElement('div');
            row.className = 'alt-ticket';
            t.blancas.forEach(n => row.appendChild(makeBall(n, 'white mini', 0)));
            row.appendChild(makeBall(t.powerball, 'red mini', 0));
            alt.appendChild(row);
        });

        document.getElementById('reasoningText').textContent =
            `1) Cinco modelos estadísticos (azar puro, frecuencia, momentum, atrasados y fríos) calculan la probabilidad de cada número. ` +
            `2) Se combinan con Promedio Bayesiano: cada modelo pesa según qué tan bien predijo los sorteos pasados que nunca vio. ` +
            `3) Se generan 40,000 combinaciones por Monte Carlo y se descartan las de estructura improbable (suma fuera de ${Math.round(r.constantes.SUM_MEAN - 1.3 * r.constantes.SUM_SD)}-${Math.round(r.constantes.SUM_MEAN + 1.3 * r.constantes.SUM_SD)}, todos pares/impares, 3+ consecutivos). ` +
            `4) Se penalizan las combinaciones que la gente juega mucho (fechas de cumpleaños ≤31, patrones, jugadas ya ganadoras): eso no aumenta la probabilidad de ganar, ` +
            `pero si ganas reduce la chance de compartir el premio — es la única ventaja matemática real que existe. ` +
            `Probabilidad del premio mayor: 1 en ${r.constantes.JACKPOT_ODDS.toLocaleString('es')}.`;

        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function makeBall(num, cls, index) {
        const b = document.createElement('div');
        b.className = 'ball ' + cls;
        b.textContent = num;
        b.style.animationDelay = `${index * 0.15}s`;
        return b;
    }

    function freqItem(label, percent, countText) {
        const item = document.createElement('div');
        item.className = 'freq-item';
        item.innerHTML = `
            <span class="num">${label}</span>
            <div class="freq-bar-bg">
                <div class="freq-bar-fill" style="width: ${Math.max(percent, 1)}%"></div>
            </div>
            <span class="count">${countText}</span>
        `;
        return item;
    }

    function renderFreqBars(containerId, numbers, counts, zScores, maxCount) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        numbers.forEach(num => {
            const z = zScores[num];
            container.appendChild(freqItem(num, counts[num] / maxCount * 100,
                `${counts[num]}x (z=${z >= 0 ? '+' : ''}${z.toFixed(1)})`));
        });
    }
});
