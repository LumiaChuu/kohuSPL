document.addEventListener('DOMContentLoaded', function() {
    // --- DOM ELEMENT SELECTION ---
    const dom = {
        sliders: {
            day: document.getElementById('day-of-year'),
            time: document.getElementById('time-of-day'),
            cloud: document.getElementById('cloud-cover'),
            temp: document.getElementById('temperature'),
            area: document.getElementById('panel-area'),
            efficiency: document.getElementById('panel-efficiency'),
            angle: document.getElementById('panel-angle'),
        },
        values: {
            day: document.getElementById('day-value'),
            time: document.getElementById('time-value'),
            cloud: document.getElementById('cloud-value'),
            temp: document.getElementById('temperature-value'),
            area: document.getElementById('area-value'),
            efficiency: document.getElementById('efficiency-value'),
            angle: document.getElementById('angle-value'),
        },
        inputs: {
            cost: document.getElementById('system-cost'),
            rate: document.getElementById('electricity-rate'),
        },
        outputs: {
            power: document.getElementById('current-power'),
            dailyEnergy: document.getElementById('daily-energy'),
            actualEfficiency: document.getElementById('actual-efficiency'),
            savings: document.getElementById('monthly-savings'),
            roi: document.getElementById('roi'),
        },
        buttons: {
            animate: document.getElementById('toggle-animation'),
            reset: document.getElementById('reset-simulation'),
        },
        visuals: {
            sky: document.querySelector('.sky'),
            sun: document.querySelector('.sun'),
            clouds: document.querySelectorAll('.cloud'),
            panel: document.querySelector('.solar-panel'),
            panelShadow: document.querySelector('.panel-shadow'),
        }
    };

    // --- SIMULATION CONSTANTS & STATE ---
    const SOLAR_CONSTANT = 1361; // W/m², more accurate value
    const TEMP_COEFFICIENT = -0.004; // -0.4% per °C, typical for silicon panels
    let animationInterval = null;
    let powerChart;
    const defaultValues = {
        day: 172, time: 12, cloud: 20, temp: 25,
        area: 10, efficiency: 22, angle: 15,
        cost: 25000000, rate: 1445
    };

    // --- INITIALIZATION ---
    function init() {
        setupEventListeners();
        resetSimulation();
        initChart();
        runFullUpdate();
    }

    function setupEventListeners() {
        Object.values(dom.sliders).forEach(slider => slider.addEventListener('input', runFullUpdate));
        Object.values(dom.inputs).forEach(input => input.addEventListener('input', runFullUpdate));
        dom.buttons.animate.addEventListener('click', toggleAnimation);
        dom.buttons.reset.addEventListener('click', resetSimulation);
    }

    function resetSimulation() {
        if (animationInterval) toggleAnimation(); // Stop animation if running
        dom.sliders.day.value = defaultValues.day;
        dom.sliders.time.value = defaultValues.time;
        dom.sliders.cloud.value = defaultValues.cloud;
        dom.sliders.temp.value = defaultValues.temp;
        dom.sliders.area.value = defaultValues.area;
        dom.sliders.efficiency.value = defaultValues.efficiency;
        dom.sliders.angle.value = defaultValues.angle;
        dom.inputs.cost.value = defaultValues.cost;
        dom.inputs.rate.value = defaultValues.rate;
        runFullUpdate();
    }

    // --- CORE CALCULATION LOGIC ---
    function getSimulationParameters() {
        return {
            day: parseInt(dom.sliders.day.value),
            time: parseFloat(dom.sliders.time.value),
            cloudCover: parseInt(dom.sliders.cloud.value) / 100,
            temp: parseInt(dom.sliders.temp.value),
            area: parseInt(dom.sliders.area.value),
            baseEfficiency: parseInt(dom.sliders.efficiency.value) / 100,
            panelAngle: parseInt(dom.sliders.angle.value),
            cost: parseFloat(dom.inputs.cost.value),
            rate: parseFloat(dom.inputs.rate.value),
        };
    }

    function calculateSolarAngles(day, time, latitude = -6.2) { // Latitude for Jakarta
        const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (day + 10));
        const hourAngle = 15 * (time - 12);
        
        const latRad = latitude * Math.PI / 180;
        const declRad = declination * Math.PI / 180;
        const hourRad = hourAngle * Math.PI / 180;

        const altitude = Math.asin(Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad));
        const azimuth = Math.acos((Math.sin(declRad) - Math.sin(altitude) * Math.sin(latRad)) / (Math.cos(altitude) * Math.cos(latRad)));

        return {
            altitude: altitude * 180 / Math.PI,
            azimuth: time <= 12 ? 180 - (azimuth * 180 / Math.PI) : 180 + (azimuth * 180 / Math.PI)
        };
    }

    function calculatePower(params, solarAngles) {
        if (solarAngles.altitude <= 0) return { power: 0, actualEfficiency: 0 };

        const altRad = solarAngles.altitude * Math.PI / 180;
        const panelAngleRad = params.panelAngle * Math.PI / 180;

        // 1. Irradiance based on sun altitude and clouds
        const airMass = 1 / (Math.sin(altRad) + 0.50572 * Math.pow(altRad * 180/Math.PI + 6.07995, -1.6364));
        const directIrradiance = SOLAR_CONSTANT * Math.pow(0.7, Math.pow(airMass, 0.678)) * (1 - params.cloudCover);
        
        // 2. Angle of Incidence Factor
        const incidenceAngle = Math.acos(Math.sin(altRad) * Math.cos(panelAngleRad) + Math.cos(altRad) * Math.sin(panelAngleRad) * Math.cos((solarAngles.azimuth - 180) * Math.PI / 180));
        const angleFactor = Math.cos(incidenceAngle);

        // 3. Temperature Factor
        const panelTemp = params.temp + (directIrradiance / 800) * 20; // Simplified panel temp calc
        const tempFactor = 1 + (panelTemp - 25) * TEMP_COEFFICIENT;

        // 4. Final Power Calculation
        const effectiveIrradiance = directIrradiance * (angleFactor > 0 ? angleFactor : 0);
        const power = effectiveIrradiance * params.area * params.baseEfficiency * tempFactor;
        
        const actualEfficiency = params.baseEfficiency * tempFactor * (angleFactor > 0 ? angleFactor : 0);
        
        return {
            power: power > 0 ? power : 0,
            actualEfficiency: actualEfficiency > 0 ? actualEfficiency : 0
        };
    }

    // --- UPDATE FUNCTIONS ---
    function runFullUpdate() {
        const params = getSimulationParameters();
        const solarAngles = calculateSolarAngles(params.day, params.time);
        const { power, actualEfficiency } = calculatePower(params, solarAngles);
        
        updateDisplayValues(params);
        updateVisualization(params, solarAngles, power);
        updateOutputMetrics(power, actualEfficiency);
        updateChart(params);
        updateFinancials(params);
    }

    function updateDisplayValues(params) {
        const date = new Date(2024, 0, params.day);
        dom.values.day.textContent = `${params.day} (${date.toLocaleDateString('id-ID', { month: 'long', day: 'numeric' })})`;
        const hours = Math.floor(params.time);
        const minutes = (params.time % 1) * 60;
        dom.values.time.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        dom.values.cloud.textContent = `${params.cloudCover * 100}%`;
        dom.values.temp.textContent = `${params.temp}°C`;
        dom.values.area.textContent = `${params.area} m²`;
        dom.values.efficiency.textContent = `${(params.baseEfficiency * 100).toFixed(1)}%`;
        dom.values.angle.textContent = `${params.panelAngle}°`;
    }

    function updateVisualization(params, solarAngles, power) {
        // Sun position
        const sunX = solarAngles.azimuth / 360 * 100;
        const sunY = 90 - solarAngles.altitude;
        dom.visuals.sun.style.left = `${sunX}%`;
        dom.visuals.sun.style.top = `${sunY}%`;
        dom.visuals.sun.style.opacity = solarAngles.altitude > 0 ? 1 : 0;
        
        // Sky color
        const skyLightness = Math.max(0, solarAngles.altitude / 90);
        dom.visuals.sky.style.background = `linear-gradient(to bottom, hsl(200, 70%, ${50 + skyLightness * 25}%), hsl(210, 70%, ${20 + skyLightness*40}%))`;

        // Cloud animation
        dom.visuals.clouds.forEach((cloud, i) => {
            const speed = 50 + i * 20;
            const startPos = -200 - i * 50;
            cloud.style.transform = `translateX(${(params.time * speed) % (window.innerWidth + 300) + startPos}px)`;
            cloud.style.opacity = Math.min(0.8, params.cloudCover * 2);
        });

        // Panel angle and glow
        dom.visuals.panel.style.transform = `rotateX(${90 - params.panelAngle}deg)`;
        const powerRatio = Math.min(power / (params.area * 200), 1);
        dom.visuals.panel.style.boxShadow = `0 0 ${20 * powerRatio}px 5px rgba(255, 215, 0, ${0.7 * powerRatio})`;
        
        // Panel shadow
        if (solarAngles.altitude > 1) {
             const shadowSkew = - (solarAngles.azimuth - 180) * 0.4;
             const shadowScaleY = 0.5 + solarAngles.altitude / 180;
             dom.visuals.panelShadow.style.opacity = 0.1 + 0.2 * (solarAngles.altitude/90);
             dom.visuals.panelShadow.style.transform = `skew(${shadowSkew}deg) scaleY(${shadowScaleY})`;
        } else {
             dom.visuals.panelShadow.style.opacity = '0';
        }
    }

    function updateOutputMetrics(power, actualEfficiency) {
        dom.outputs.power.textContent = `${power.toFixed(1)} W`;
        dom.outputs.actualEfficiency.textContent = `${(actualEfficiency * 100).toFixed(1)}%`;
    }

    function updateFinancials(params) {
        let dailyEnergyKWh = 0;
        for (let t = 5; t <= 19; t += 0.5) {
            const solarAngles = calculateSolarAngles(params.day, t);
            const p = calculatePower(params, solarAngles).power;
            dailyEnergyKWh += p * 0.5; // Power * 0.5 hour interval
        }
        dailyEnergyKWh /= 1000;

        dom.outputs.dailyEnergy.textContent = `${dailyEnergyKWh.toFixed(2)} kWh`;

        const monthlySavings = dailyEnergyKWh * 30 * params.rate;
        dom.outputs.savings.textContent = `Rp ${monthlySavings.toLocaleString('id-ID', {maximumFractionDigits: 0})}`;

        if (monthlySavings > 0) {
            const roiMonths = params.cost / monthlySavings;
            const roiYears = roiMonths / 12;
            dom.outputs.roi.textContent = `~ ${roiYears.toFixed(1)} tahun`;
        } else {
            dom.outputs.roi.textContent = "N/A";
        }
    }
    
    // --- CHART FUNCTIONS ---
    function initChart() {
        const ctx = document.getElementById('power-chart').getContext('2d');
        powerChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: 29 }, (_, i) => `${Math.floor(5 + i * 0.5)}:${(i % 2) * 30}`.replace(':0',':00').replace(':3',':30')),
                datasets: [{
                    label: 'Produksi Daya (Watt)',
                    data: [],
                    borderColor: '#007aff',
                    backgroundColor: 'rgba(0, 122, 255, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Daya (W)' }},
                          x: { title: { display: true, text: 'Waktu' }}}
            }
        });
    }

    function updateChart(params) {
        const powerData = [];
        for (let t = 5; t <= 19; t += 0.5) {
            const solarAngles = calculateSolarAngles(params.day, t);
            powerData.push(calculatePower(params, solarAngles).power);
        }
        powerChart.data.datasets[0].data = powerData;
        powerChart.update('none');
    }

    // --- ANIMATION ---
    function toggleAnimation() {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
            dom.buttons.animate.textContent = '▶️ Mulai Animasi Harian';
        } else {
            dom.sliders.time.value = 5;
            dom.buttons.animate.textContent = '⏹️ Hentikan Animasi';
            animationInterval = setInterval(() => {
                let currentTime = parseFloat(dom.sliders.time.value);
                currentTime += 0.25;
                if (currentTime > 19) {
                    currentTime = 5;
                }
                dom.sliders.time.value = currentTime;
                runFullUpdate();
            }, 50);
        }
    }

    // --- START THE SIMULATION ---
    init();
});
