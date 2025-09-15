const Utils = {
    animateValue(id, end) {
        const el = document.getElementById(id);
        if (!el) return;
        const start = parseFloat(el.textContent) || 0;
        if (start === end) return;
        let startTimestamp;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / 500, 1);
            el.textContent = (progress * (end - start) + start).toFixed(1);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    createLeafParticles() {
        const container = document.getElementById('leaf-particle-container');
        if (!container) return;
        const emojis = ['🌿', '🍃', '🌱', '☘️'];
        for (let i = 0; i < 30; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf-particle';
            leaf.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            leaf.style.left = `${Math.random() * 100}vw`;
            leaf.style.animationDuration = `${15 + Math.random() * 10}s`;
            leaf.style.animationDelay = `${Math.random() * 15}s`;
            container.appendChild(leaf);
        }
    },

    convertSoilMoistureToPercentage(rawValue) {
        const DRY_VALUE = 4095, WET_VALUE = 1800; 
        const percentage = 100 * (DRY_VALUE - rawValue) / (DRY_VALUE - WET_VALUE);
        return Math.max(0, Math.min(100, Math.round(percentage)));
    },

    calculateHealthScore(data, activeProfile) {
        if (!activeProfile) return { score: 0, status: 'N/A', color: 'text-gray-400', icon: 'bx-help-circle' };
        let score = 100;
        const check = (val, [min, max]) => val < min || val > max;
        if (check(data.temperature, activeProfile.temp)) score -= 33.3;
        if (check(data.humidity, activeProfile.humidity)) score -= 33.3;
        if (check(data.soilMoisture, activeProfile.soil)) score -= 33.3;
        score = Math.max(0, Math.round(score));
        if (score >= 85) return { score, status: 'Excellent', color: 'text-green-500', icon: 'bx-happy-heart-eyes' };
        if (score >= 60) return { score, status: 'Good', color: 'text-yellow-500', icon: 'bx-happy-alt' };
        return { score, status: 'Warning', color: 'text-red-500', icon: 'bx-sad' };
    },

    getWeatherIcon(id) {
        if (id < 300) return 'bxs-thunder-house'; 
        if (id < 600) return 'bxs-rain'; 
        if (id < 700) return 'bxs-snow'; 
        if (id < 800) return 'bxs-layer'; 
        if (id === 800) return 'bxs-sun'; 
        return 'bxs-cloud';
    }
};