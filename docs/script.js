document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const sunlightIntensitySlider = document.getElementById('sunlight-intensity');
    const panelEfficiencySlider = document.getElementById('panel-efficiency');
    const panelAngleSlider = document.getElementById('panel-angle');
    const panelAreaSlider = document.getElementById('panel-area');
    const timeOfDaySlider = document.getElementById('time-of-day');
    const toggleAnimationButton = document.getElementById('toggle-animation');
    
    const intensityValue = document.getElementById('intensity-value');
    const efficiencyValue = document.getElementById('efficiency-value');
    const angleValue = document.getElementById('angle-value');
    const areaValue = document.getElementById('area-value');
    const timeValue = document.getElementById('time-value');
    
    const currentPowerOutput = document.getElementById('current-power');
    const dailyEnergyOutput = document.getElementById('daily-energy');
    const actualEfficiencyOutput = document.getElementById('actual-efficiency');
    
    const solarPanel = document.querySelector('.solar-panel');
    const panelContainer = document.querySelector('.panel-container');
    const sun = document.querySelector('.sun');
    const clouds = document.querySelectorAll('.cloud');
    const cells = document.querySelectorAll('.cell');
    
    // Chart setup
    const ctx = document.getElementById('power-chart').getContext('2d');
    const powerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 13}, (_, i) => `${i + 6}:00`),
            datasets: [{
                label: 'Daya (Watt)',
                data: Array(13).fill(0),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Daya (Watt)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Waktu'
                    }
                }
            }
        }
    });
    
    // Simulation variables
    let isAnimating = false;
    let simulationInterval;
    let totalDailyEnergy = 0;
    let powerData = Array(13).fill(0);
    
    // Constants
    const SOLAR_CONSTANT = 1000; // W/m² at peak
    const HOUR_IN_MS = 3600000; // 1 hour in milliseconds
    
    // Update display values
    function updateDisplayValues() {
        intensityValue.textContent = `${sunlightIntensitySlider.value}%`;
        efficiencyValue.textContent = `${panelEfficiencySlider.value}%`;
        angleValue.textContent = `${panelAngleSlider.value}°`;
        areaValue.textContent = `${panelAreaSlider.value} m²`;
        
        const hour = parseInt(timeOfDaySlider.value);
        const hourFormatted = hour < 10 ? `0${hour}` : hour;
        timeValue.textContent = `${hourFormatted}:00`;
    }
    
    // Calculate power output
    function calculatePower() {
        const intensity = parseInt(sunlightIntensitySlider.value) / 100;
        const efficiency = parseInt(panelEfficiencySlider.value) / 100;
        const angle = parseInt(panelAngleSlider.value);
        const area = parseInt(panelAreaSlider.value);
        const time = parseInt(timeOfDaySlider.value);
        
        // Calculate sun position factor (time of day effect)
        // Peak at noon (12:00), lower at morning and evening
        const timeOfDayFactor = 1 - Math.abs(time - 12) / 6;
        
        // Calculate angle factor (optimal angle is around 30-40 degrees depending on latitude)
        // This is a simplified model
        const optimalAngle = 35;
        const angleFactor = 1 - Math.abs(angle - optimalAngle) / 90;
        
        // Calculate actual power
        const power = SOLAR_CONSTANT * intensity * efficiency * area * timeOfDayFactor * angleFactor;
        
        // Calculate actual efficiency based on angle and time factors
        const actualEfficiency = efficiency * timeOfDayFactor * angleFactor;
        
        return {
            power: power.toFixed(2),
            actualEfficiency: (actualEfficiency * 100).toFixed(1)
        };
    }
    
    // Update visualization
    function updateVisualization() {
        const intensity = parseInt(sunlightIntensitySlider.value) / 100;
        const angle = parseInt(panelAngleSlider.value);
        const time = parseInt(timeOfDaySlider.value);
        
        // Update sun position based on time of day
        const sunLeftPos = ((time - 6) / 12) * 100; // 6am to 6pm mapped to 0-100%
        const sunTopPos = 50 - Math.sin(((time - 6) / 12) * Math.PI) * 30; // Arc path
        sun.style.left = `${sunLeftPos}%`;
        sun.style.top = `${sunTopPos}%`;
        
        // Update sun brightness based on intensity
        sun.style.opacity = intensity;
        sun.style.boxShadow = `0 0 ${40 * intensity}px ${20 * intensity}px rgba(255, 255, 0, ${0.8 * intensity})`;
        
        // Update clouds opacity (inverse of intensity to simulate cloud cover)
        const cloudOpacity = 1 - intensity;
        clouds.forEach(cloud => {
            cloud.style.opacity = 0.3 + (cloudOpacity * 0.7); // Min opacity 0.3
        });
        
        // Update panel angle
        solarPanel.style.transform = `rotateX(${90 - angle}deg)`;
        
        // Update panel cells glow based on power output
        const { power } = calculatePower();
        const powerRatio = Math.min(power / 1000, 1); // Normalize to 0-1
        
        cells.forEach(cell => {
            cell.style.backgroundColor = `rgba(30, 144, 255, ${0.5 + powerRatio * 0.5})`;
            cell.style.boxShadow = `0 0 ${10 * powerRatio}px ${5 * powerRatio}px rgba(30, 144, 255, ${0.8 * powerRatio})`;
        });
    }
    
    // Update output metrics
    function updateOutputMetrics() {
        const { power, actualEfficiency } = calculatePower();
        
        currentPowerOutput.textContent = `${power} W`;
        actualEfficiencyOutput.textContent = `${actualEfficiency}%`;
        
        // Update chart data
        const timeIndex = parseInt(timeOfDaySlider.value) - 6; // 6am is index 0
        powerData[timeIndex] = parseFloat(power);
        powerChart.data.datasets[0].data = powerData;
        powerChart.update();
        
        // Calculate daily energy (area under the power curve)
        // Simple trapezoidal integration
        let dailyEnergy = 0;
        for (let i = 0; i < powerData.length - 1; i++) {
            dailyEnergy += (powerData[i] + powerData[i + 1]) / 2;
        }
        // Convert watt-hours to kilowatt-hours
        dailyEnergy = (dailyEnergy / 1000).toFixed(2);
        dailyEnergyOutput.textContent = `${dailyEnergy} kWh`;
    }
    
    // Run simulation
    function runSimulation() {
        updateDisplayValues();
        updateVisualization();
        updateOutputMetrics();
    }
    
    // Toggle animation
    function toggleAnimation() {
        isAnimating = !isAnimating;
        
        if (isAnimating) {
            toggleAnimationButton.textContent = 'Hentikan Simulasi';
            simulationInterval = setInterval(() => {
                // Increment time
                const currentTime = parseInt(timeOfDaySlider.value);
                const newTime = currentTime >= 18 ? 6 : currentTime + 1;
                timeOfDaySlider.value = newTime;
                
                runSimulation();
            }, 1000); // Update every second
        } else {
            toggleAnimationButton.textContent = 'Mulai Simulasi';
            clearInterval(simulationInterval);
        }
    }
    
    // Event listeners
    sunlightIntensitySlider.addEventListener('input', runSimulation);
    panelEfficiencySlider.addEventListener('input', runSimulation);
    panelAngleSlider.addEventListener('input', runSimulation);
    panelAreaSlider.addEventListener('input', runSimulation);
    timeOfDaySlider.addEventListener('input', runSimulation);
    toggleAnimationButton.addEventListener('click', toggleAnimation);
    
    // Initialize simulation
    runSimulation();
});