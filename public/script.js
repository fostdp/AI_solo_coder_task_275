const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
const responseCanvas = document.getElementById('responseCanvas');
const responseCtx = responseCanvas.getContext('2d');

const devicePixelRatio = window.devicePixelRatio || 1;
const canvasWidth = 900;
const canvasHeight = 400;
const responseCanvasWidth = 900;
const responseCanvasHeight = 250;

function initCanvas() {
    canvas.width = canvasWidth * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    responseCanvas.width = responseCanvasWidth * devicePixelRatio;
    responseCanvas.height = responseCanvasHeight * devicePixelRatio;
    responseCanvas.style.width = responseCanvasWidth + 'px';
    responseCanvas.style.height = responseCanvasHeight + 'px';
    responseCtx.scale(devicePixelRatio, devicePixelRatio);
}

const TUBE_TOP = 150;
const TUBE_BOTTOM = 250;
const TUBE_LEFT = 50;
const TUBE_RIGHT = 850;

const MEDIA_SPEEDS = {
    air: 343,
    water: 1480,
    steel: 5000,
    glass: 4540
};

let isDragging = false;
let animationId = null;
let lastFrameTime = 0;

let state = {
    frequency: 100,
    tubeLength: 1.0,
    waveSpeed: 343,
    tubeType: 'oneEndOpen',
    showMolecules: false,
    showFrequencyResponse: false,
    time: 0,
    molecules: []
};

function initMolecules() {
    state.molecules = [];
    const tubeWidth = TUBE_RIGHT - TUBE_LEFT;
    const tubeHeight = TUBE_BOTTOM - TUBE_TOP;
    
    for (let i = 0; i < 200; i++) {
        state.molecules.push({
            x: TUBE_LEFT + Math.random() * tubeWidth,
            y: TUBE_TOP + 10 + Math.random() * (tubeHeight - 20),
            originalX: 0,
            radius: 3 + Math.random() * 2
        });
    }
    state.molecules.forEach(m => m.originalX = m.x);
}

function getWaveNumberMultiplier() {
    switch (state.tubeType) {
        case 'oneEndOpen':
            return { kFactor: Math.PI / (2 * state.tubeLength), harmonicStep: 2, firstHarmonic: 1 };
        case 'bothEndsOpen':
            return { kFactor: Math.PI / state.tubeLength, harmonicStep: 1, firstHarmonic: 1 };
        case 'bothEndsClosed':
            return { kFactor: Math.PI / state.tubeLength, harmonicStep: 1, firstHarmonic: 1 };
        default:
            return { kFactor: Math.PI / (2 * state.tubeLength), harmonicStep: 2, firstHarmonic: 1 };
    }
}

function calculateHarmonic() {
    const fundamental = calculateFundamentalFrequency();
    const { harmonicStep, firstHarmonic } = getWaveNumberMultiplier();
    const n = Math.round((state.frequency - fundamental) / (fundamental * harmonicStep));
    return Math.max(firstHarmonic, firstHarmonic + n * harmonicStep);
}

function calculateFundamentalFrequency() {
    switch (state.tubeType) {
        case 'oneEndOpen':
            return state.waveSpeed / (4 * state.tubeLength);
        case 'bothEndsOpen':
        case 'bothEndsClosed':
            return state.waveSpeed / (2 * state.tubeLength);
        default:
            return state.waveSpeed / (4 * state.tubeLength);
    }
}

function calculateResonantFrequencies() {
    const fundamental = calculateFundamentalFrequency();
    const { harmonicStep, firstHarmonic } = getWaveNumberMultiplier();
    const frequencies = [];
    
    for (let n = firstHarmonic; frequencies.length < 10; n += harmonicStep) {
        const freq = n * fundamental;
        if (freq <= 5000) {
            frequencies.push({ harmonic: n, frequency: freq });
        }
    }
    return frequencies;
}

function calculateNearestResonantFrequency() {
    const frequencies = calculateResonantFrequencies();
    let nearest = frequencies[0];
    let minDiff = Math.abs(state.frequency - nearest.frequency);
    
    frequencies.forEach(f => {
        const diff = Math.abs(state.frequency - f.frequency);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = f;
        }
    });
    return nearest;
}

function calculateWavelength() {
    return state.waveSpeed / state.frequency;
}

function getDisplacement(x, t) {
    const tubeWidth = TUBE_RIGHT - TUBE_LEFT;
    const normalizedX = (x - TUBE_LEFT) / tubeWidth;
    const { kFactor } = getWaveNumberMultiplier();
    const omega = 2 * Math.PI * state.frequency;
    
    let displacement;
    switch (state.tubeType) {
        case 'oneEndOpen':
            displacement = Math.sin(kFactor * normalizedX * state.tubeLength) * Math.cos(omega * t);
            break;
        case 'bothEndsOpen':
            displacement = Math.cos(kFactor * normalizedX * state.tubeLength) * Math.cos(omega * t);
            break;
        case 'bothEndsClosed':
            displacement = Math.sin(kFactor * normalizedX * state.tubeLength) * Math.cos(omega * t);
            break;
        default:
            displacement = Math.sin(kFactor * normalizedX * state.tubeLength) * Math.cos(omega * t);
    }
    return displacement * 30;
}

function getPressure(x, t) {
    const tubeWidth = TUBE_RIGHT - TUBE_LEFT;
    const normalizedX = (x - TUBE_LEFT) / tubeWidth;
    const { kFactor } = getWaveNumberMultiplier();
    const omega = 2 * Math.PI * state.frequency;
    
    let pressure;
    switch (state.tubeType) {
        case 'oneEndOpen':
            pressure = Math.cos(kFactor * normalizedX * state.tubeLength) * Math.sin(omega * t);
            break;
        case 'bothEndsOpen':
            pressure = -Math.sin(kFactor * normalizedX * state.tubeLength) * Math.sin(omega * t);
            break;
        case 'bothEndsClosed':
            pressure = Math.cos(kFactor * normalizedX * state.tubeLength) * Math.sin(omega * t);
            break;
        default:
            pressure = Math.cos(kFactor * normalizedX * state.tubeLength) * Math.sin(omega * t);
    }
    return pressure;
}

function getPressureColor(pressure) {
    const absPressure = Math.min(Math.max(Math.abs(pressure), 0), 1);
    const alpha = Math.min(Math.max(0.3 + absPressure * 0.4, 0.3), 0.7);
    
    if (absPressure > 0.66) {
        return `rgba(229, 62, 62, ${alpha})`;
    } else if (absPressure > 0.33) {
        return `rgba(246, 173, 85, ${alpha})`;
    } else {
        return `rgba(104, 211, 145, ${alpha})`;
    }
}

function drawTube() {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(TUBE_LEFT, TUBE_TOP - 5, TUBE_RIGHT - TUBE_LEFT, 10);
    ctx.fillRect(TUBE_LEFT, TUBE_BOTTOM - 5, TUBE_RIGHT - TUBE_LEFT, 10);
    
    switch (state.tubeType) {
        case 'oneEndOpen':
            ctx.fillRect(TUBE_LEFT, TUBE_TOP, 10, TUBE_BOTTOM - TUBE_TOP);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(TUBE_LEFT, TUBE_TOP);
            ctx.lineTo(TUBE_LEFT, TUBE_BOTTOM);
            ctx.stroke();
            break;
        case 'bothEndsClosed':
            ctx.fillRect(TUBE_LEFT, TUBE_TOP, 10, TUBE_BOTTOM - TUBE_TOP);
            ctx.fillRect(TUBE_RIGHT - 10, TUBE_TOP, 10, TUBE_BOTTOM - TUBE_TOP);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(TUBE_LEFT, TUBE_TOP);
            ctx.lineTo(TUBE_LEFT, TUBE_BOTTOM);
            ctx.moveTo(TUBE_RIGHT, TUBE_TOP);
            ctx.lineTo(TUBE_RIGHT, TUBE_BOTTOM);
            ctx.stroke();
            break;
        case 'bothEndsOpen':
            break;
    }
    
    ctx.fillStyle = '#4A5568';
    ctx.font = '12px Arial';
    const centerY = (TUBE_TOP + TUBE_BOTTOM) / 2;
    
    switch (state.tubeType) {
        case 'oneEndOpen':
            ctx.fillText('封闭端', TUBE_LEFT - 50, centerY + 5);
            ctx.fillText('开口端', TUBE_RIGHT + 10, centerY + 5);
            break;
        case 'bothEndsOpen':
            ctx.fillText('开口端', TUBE_LEFT - 50, centerY + 5);
            ctx.fillText('开口端', TUBE_RIGHT + 10, centerY + 5);
            break;
        case 'bothEndsClosed':
            ctx.fillText('封闭端', TUBE_LEFT - 50, centerY + 5);
            ctx.fillText('封闭端', TUBE_RIGHT + 10, centerY + 5);
            break;
    }
}

function drawPressureGradient() {
    for (let x = TUBE_LEFT; x < TUBE_RIGHT; x += 5) {
        const pressure = getPressure(x, state.time);
        ctx.fillStyle = getPressureColor(pressure);
        ctx.fillRect(x, TUBE_TOP, 6, TUBE_BOTTOM - TUBE_TOP);
    }
}

function drawDisplacementWave() {
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const centerY = (TUBE_TOP + TUBE_BOTTOM) / 2;
    
    for (let x = TUBE_LEFT; x <= TUBE_RIGHT; x += 2) {
        const displacement = getDisplacement(x, state.time);
        const y = centerY - displacement;
        
        if (x === TUBE_LEFT) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
}

function drawNodesAndAntinodes() {
    const harmonic = calculateHarmonic();
    const centerY = (TUBE_TOP + TUBE_BOTTOM) / 2;
    const tubeWidth = TUBE_RIGHT - TUBE_LEFT;
    
    let nodePositions = [];
    let antinodePositions = [];
    
    switch (state.tubeType) {
        case 'oneEndOpen':
            for (let i = 0; i < harmonic; i++) {
                nodePositions.push(TUBE_LEFT + tubeWidth * ((2 * i) / (2 * harmonic)));
                antinodePositions.push(TUBE_LEFT + tubeWidth * ((2 * i + 1) / (2 * harmonic)));
            }
            break;
        case 'bothEndsOpen':
            for (let i = 0; i <= harmonic; i++) {
                antinodePositions.push(TUBE_LEFT + tubeWidth * (i / harmonic));
            }
            for (let i = 0; i < harmonic; i++) {
                nodePositions.push(TUBE_LEFT + tubeWidth * ((i + 0.5) / harmonic));
            }
            break;
        case 'bothEndsClosed':
            for (let i = 0; i <= harmonic; i++) {
                nodePositions.push(TUBE_LEFT + tubeWidth * (i / harmonic));
            }
            for (let i = 0; i < harmonic; i++) {
                antinodePositions.push(TUBE_LEFT + tubeWidth * ((i + 0.5) / harmonic));
            }
            break;
    }
    
    ctx.fillStyle = '#e53e3e';
    nodePositions.forEach(x => {
        ctx.beginPath();
        ctx.arc(x, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.fillStyle = '#68d391';
    antinodePositions.forEach(x => {
        ctx.beginPath();
        ctx.arc(x, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.fillStyle = '#4A5568';
    ctx.font = '11px Arial';
    if (nodePositions.length > 0) {
        ctx.fillText('波节', nodePositions[0] - 15, centerY - 20);
    }
    if (antinodePositions.length > 0) {
        ctx.fillText('波腹', antinodePositions[Math.floor(antinodePositions.length / 2)] - 15, centerY + 35);
    }
}

function drawMolecules() {
    if (!state.showMolecules) return;
    
    state.molecules.forEach(mol => {
        const displacement = getDisplacement(mol.originalX, state.time) * 0.5;
        mol.x = mol.originalX + displacement;
        
        ctx.fillStyle = '#718096';
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCenterLine() {
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(TUBE_LEFT, (TUBE_TOP + TUBE_BOTTOM) / 2);
    ctx.lineTo(TUBE_RIGHT, (TUBE_TOP + TUBE_BOTTOM) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawFrequencyResponse() {
    if (!state.showFrequencyResponse) return;
    
    responseCtx.clearRect(0, 0, responseCanvasWidth, responseCanvasHeight);
    
    const padding = 50;
    const width = responseCanvasWidth - 2 * padding;
    const height = responseCanvasHeight - 2 * padding;
    
    responseCtx.strokeStyle = '#e2e8f0';
    responseCtx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height / 5) * i;
        responseCtx.beginPath();
        responseCtx.moveTo(padding, y);
        responseCtx.lineTo(padding + width, y);
        responseCtx.stroke();
    }
    
    const resonantFreqs = calculateResonantFrequencies();
    const maxFreq = Math.max(5000, resonantFreqs[resonantFreqs.length - 1]?.frequency || 1000);
    
    responseCtx.strokeStyle = '#667eea';
    responseCtx.lineWidth = 2;
    responseCtx.beginPath();
    
    let firstPoint = true;
    for (let f = 20; f <= maxFreq; f += 10) {
        let response = 0;
        resonantFreqs.forEach(res => {
            const sigma = res.frequency * 0.02;
            response += Math.exp(-Math.pow(f - res.frequency, 2) / (2 * sigma * sigma));
        });
        
        const x = padding + (f / maxFreq) * width;
        const y = padding + height - response * height;
        
        if (firstPoint) {
            responseCtx.moveTo(x, y);
            firstPoint = false;
        } else {
            responseCtx.lineTo(x, y);
        }
    }
    responseCtx.stroke();
    
    responseCtx.fillStyle = '#e53e3e';
    resonantFreqs.forEach(res => {
        const x = padding + (res.frequency / maxFreq) * width;
        responseCtx.beginPath();
        responseCtx.arc(x, padding + height, 5, 0, Math.PI * 2);
        responseCtx.fill();
    });
    
    const currentX = padding + (state.frequency / maxFreq) * width;
    responseCtx.strokeStyle = '#e53e3e';
    responseCtx.lineWidth = 2;
    responseCtx.setLineDash([5, 5]);
    responseCtx.beginPath();
    responseCtx.moveTo(currentX, padding);
    responseCtx.lineTo(currentX, padding + height);
    responseCtx.stroke();
    responseCtx.setLineDash([]);
    
    responseCtx.fillStyle = '#4A5568';
    responseCtx.font = '12px Arial';
    responseCtx.fillText('频率 (Hz)', padding + width / 2 - 30, padding + height + 30);
    responseCtx.save();
    responseCtx.translate(15, padding + height / 2);
    responseCtx.rotate(-Math.PI / 2);
    responseCtx.fillText('振幅', -20, 0);
    responseCtx.restore();
    
    for (let i = 0; i <= 5; i++) {
        const freq = (maxFreq / 5) * i;
        const x = padding + (freq / maxFreq) * width;
        responseCtx.fillText(Math.round(freq).toString(), x - 15, padding + height + 15);
    }
}

function updateResonantList() {
    const resonantFreqs = calculateResonantFrequencies();
    const nearest = calculateNearestResonantFrequency();
    const list = document.getElementById('resonantList');
    
    list.innerHTML = resonantFreqs.map(res => {
        const isActive = Math.abs(nearest.frequency - res.frequency) < 1;
        return `<span class="resonant-tag ${isActive ? 'active' : ''}" data-freq="${res.frequency}">
                    ${res.harmonic}次: ${res.frequency.toFixed(1)}Hz
                </span>`;
    }).join('');
    
    document.querySelectorAll('.resonant-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            state.frequency = parseFloat(tag.dataset.freq);
            document.getElementById('frequencySlider').value = state.frequency;
            document.getElementById('frequencyValue').textContent = Math.round(state.frequency);
            updateInfo();
        });
    });
}

function updateInfo() {
    const harmonic = calculateHarmonic();
    const wavelength = calculateWavelength();
    const fundamental = calculateFundamentalFrequency();
    const nearest = calculateNearestResonantFrequency();
    
    document.getElementById('harmonic').textContent = harmonic;
    document.getElementById('wavelength').textContent = wavelength.toFixed(2);
    document.getElementById('waveSpeed').textContent = state.waveSpeed;
    document.getElementById('fundamentalFreq').textContent = fundamental.toFixed(2);
    document.getElementById('resonantFreq').textContent = nearest.frequency.toFixed(2);
    
    const tubeWidth = TUBE_RIGHT - TUBE_LEFT;
    let nodePositions = [];
    let antinodePositions = [];
    
    switch (state.tubeType) {
        case 'oneEndOpen':
            for (let i = 0; i < harmonic && i < 3; i++) {
                const nodePos = ((2 * i) / (2 * harmonic)) * state.tubeLength;
                nodePositions.push(nodePos.toFixed(2) + 'm');
                const antinodePos = ((2 * i + 1) / (2 * harmonic)) * state.tubeLength;
                antinodePositions.push(antinodePos.toFixed(2) + 'm');
            }
            break;
        case 'bothEndsOpen':
        case 'bothEndsClosed':
            for (let i = 0; i < Math.min(harmonic + 1, 4); i++) {
                const pos = (i / harmonic) * state.tubeLength;
                if (state.tubeType === 'bothEndsClosed') {
                    nodePositions.push(pos.toFixed(2) + 'm');
                } else {
                    antinodePositions.push(pos.toFixed(2) + 'm');
                }
            }
            break;
    }
    
    document.getElementById('antinodes').textContent = antinodePositions.join(', ') || '-';
    document.getElementById('nodes').textContent = nodePositions.join(', ') || '-';
    
    updateResonantList();
}

function draw(currentTime) {
    if (!lastFrameTime) lastFrameTime = currentTime;
    const deltaTime = currentTime - lastFrameTime;
    
    if (deltaTime >= 16) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        drawPressureGradient();
        drawCenterLine();
        drawTube();
        drawDisplacementWave();
        drawNodesAndAntinodes();
        drawMolecules();
        
        if (state.showFrequencyResponse) {
            drawFrequencyResponse();
        }
        
        state.time += 0.001 * Math.min(deltaTime / 16, 3);
        lastFrameTime = currentTime;
    }
    
    animationId = requestAnimationFrame(draw);
}

function exportScreenshot() {
    const link = document.createElement('a');
    link.download = `驻波管实验_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function getExperimentData() {
    return {
        timestamp: new Date().toISOString(),
        tubeType: state.tubeType,
        tubeTypeName: {
            'oneEndOpen': '一端封闭一端开口',
            'bothEndsOpen': '两端开口',
            'bothEndsClosed': '两端封闭'
        }[state.tubeType],
        frequency: state.frequency,
        tubeLength: state.tubeLength,
        waveSpeed: state.waveSpeed,
        harmonic: calculateHarmonic(),
        wavelength: calculateWavelength(),
        fundamentalFrequency: calculateFundamentalFrequency(),
        nearestResonantFrequency: calculateNearestResonantFrequency().frequency
    };
}

function exportCSV() {
    const data = getExperimentData();
    const headers = Object.keys(data).join(',');
    const values = Object.values(data).map(v => `"${v}"`).join(',');
    
    const csv = `${headers}\n${values}`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `驻波管实验数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
}

function exportJSON() {
    const data = getExperimentData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `驻波管实验数据_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
}

function saveExperiment() {
    const data = getExperimentData();
    let experiments = JSON.parse(localStorage.getItem('experiments') || '[]');
    experiments.unshift(data);
    if (experiments.length > 50) experiments.pop();
    localStorage.setItem('experiments', JSON.stringify(experiments));
    
    alert(`实验数据已保存！\n管型: ${data.tubeTypeName}\n频率: ${data.frequency} Hz\n谐波: ${data.harmonic}次`);
}

function resetExperiment() {
    state = {
        frequency: 100,
        tubeLength: 1.0,
        waveSpeed: 343,
        tubeType: 'oneEndOpen',
        showMolecules: false,
        showFrequencyResponse: false,
        time: 0,
        molecules: []
    };
    
    document.getElementById('frequencySlider').value = 100;
    document.getElementById('frequencyValue').textContent = '100';
    document.getElementById('tubeLengthSlider').value = 1;
    document.getElementById('tubeLengthValue').textContent = '1.0';
    document.getElementById('tubeType').value = 'oneEndOpen';
    document.getElementById('mediumType').value = 'air';
    document.getElementById('showMolecules').checked = false;
    document.getElementById('showFrequencyResponse').checked = false;
    document.getElementById('customSpeedGroup').style.display = 'none';
    document.getElementById('frequencyResponsePanel').style.display = 'none';
    
    initMolecules();
    updateInfo();
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

const frequencySlider = document.getElementById('frequencySlider');
const handleFrequencyChange = throttle((e) => {
    state.frequency = parseFloat(e.target.value);
    document.getElementById('frequencyValue').textContent = Math.round(state.frequency);
    updateInfo();
}, 16);

frequencySlider.addEventListener('input', handleFrequencyChange);
frequencySlider.addEventListener('mousedown', () => isDragging = true);
frequencySlider.addEventListener('mouseup', () => {
    isDragging = false;
    updateInfo();
});
frequencySlider.addEventListener('mouseleave', () => isDragging = false);

const tubeLengthSlider = document.getElementById('tubeLengthSlider');
const handleTubeLengthChange = throttle((e) => {
    state.tubeLength = parseFloat(e.target.value);
    document.getElementById('tubeLengthValue').textContent = state.tubeLength.toFixed(1);
    updateInfo();
}, 16);

tubeLengthSlider.addEventListener('input', handleTubeLengthChange);
tubeLengthSlider.addEventListener('mousedown', () => isDragging = true);
tubeLengthSlider.addEventListener('mouseup', () => {
    isDragging = false;
    updateInfo();
});
tubeLengthSlider.addEventListener('mouseleave', () => isDragging = false);

document.getElementById('tubeType').addEventListener('change', (e) => {
    state.tubeType = e.target.value;
    updateInfo();
});

document.getElementById('mediumType').addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        document.getElementById('customSpeedGroup').style.display = 'flex';
    } else {
        document.getElementById('customSpeedGroup').style.display = 'none';
        state.waveSpeed = MEDIA_SPEEDS[e.target.value];
    }
    updateInfo();
});

document.getElementById('customSpeed').addEventListener('input', (e) => {
    state.waveSpeed = parseFloat(e.target.value) || 343;
    updateInfo();
});

document.getElementById('showMolecules').addEventListener('change', (e) => {
    state.showMolecules = e.target.checked;
    if (state.showMolecules && state.molecules.length === 0) {
        initMolecules();
    }
});

document.getElementById('showFrequencyResponse').addEventListener('change', (e) => {
    state.showFrequencyResponse = e.target.checked;
    document.getElementById('frequencyResponsePanel').style.display = state.showFrequencyResponse ? 'block' : 'none';
});

document.getElementById('saveBtn').addEventListener('click', saveExperiment);
document.getElementById('screenshotBtn').addEventListener('click', exportScreenshot);
document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
document.getElementById('resetBtn').addEventListener('click', resetExperiment);

window.addEventListener('load', () => {
    initCanvas();
    initMolecules();
    updateInfo();
    draw();
});

window.addEventListener('resize', () => {
    initCanvas();
});