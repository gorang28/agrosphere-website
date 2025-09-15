const uiController = (() => {
    let liveChart;
    let currentTheme = 'light';
    
    const DOMstrings = {
        body: 'body',
        authContainer: '#auth-container',
        dashboardContainer: '#dashboard-container',
        skeletonLoader: '#skeleton-loader',
        dashboardContent: '#dashboard-content',
        flipCard: '#flip-card',
        loginButton: '#login-button',
        registerButton: '#register-button',
        loginFeedback: '#login-feedback',
        registerFeedback: '#register-feedback',
        greetingText: '#greeting-text',
        currentDate: '#current-date',
        healthIcon: '#health-icon',
        healthScore: '#health-score',
        healthStatus: '#health-status',
        appContainer: '#app-container',
        darkModeToggle: '#dark-mode-toggle'
    };

    const updateChartTheme = () => {
        if (!liveChart) return;
        const isDark = currentTheme === 'dark';
        const color = isDark ? '#e5e7eb' : '#1f2937';
        liveChart.options.scales.x.ticks.color = color;
        liveChart.options.plugins.legend.labels.color = color;
        liveChart.options.scales.yTemp.title.color = liveChart.options.scales.yTemp.ticks.color = '#ef4444';
        liveChart.options.scales.yHumidity.title.color = liveChart.options.scales.yHumidity.ticks.color = '#3b82f6';
        liveChart.update();
    };

    return {
        getDOMstrings: () => DOMstrings,

        // In uiController.js
// REPLACE your old initChart function with this one

initChart: () => {
    // THIS IS THE FIX: Check if a chart instance already exists
    if (liveChart) {
        liveChart.destroy(); // Destroy the old chart before creating a new one
    }

    const ctx = document.getElementById('live-chart').getContext('2d');
    liveChart = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: [], 
            datasets: [ 
                { label: 'Temp', data: [], borderColor: '#ef4444', tension: 0.3, yAxisID: 'yTemp' }, 
                { label: 'Humidity', data: [], borderColor: '#3b82f6', tension: 0.3, yAxisID: 'yHumidity' }, 
                { label: 'Soil', data: [], borderColor: '#eab308', tension: 0.3, yAxisID: 'yHumidity' } 
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                x: {}, 
                yTemp: { type: 'linear', position: 'left', title: { display: true, text: 'Temperature (°C)', color: '#ef4444' }, ticks: { color: '#ef4444' } }, 
                yHumidity: { type: 'linear', position: 'right', title: { display: true, text: 'Humidity / Soil (%)', color: '#3b82f6' }, ticks: { color: '#3b82f6' }, min: 0, max: 100 } 
            } 
        } 
    });
    updateChartTheme();
},

        showLogin: () => {
            document.querySelector(DOMstrings.dashboardContainer).classList.add('hidden');
            document.querySelector(DOMstrings.authContainer).classList.remove('hidden');
        },
        
        showDashboard: (username) => {
            document.querySelector(DOMstrings.authContainer).classList.add('hidden');
            document.querySelector(DOMstrings.dashboardContainer).classList.remove('hidden');
            
            setTimeout(() => {
                document.querySelector(DOMstrings.skeletonLoader).classList.add('hidden');
                document.querySelector(DOMstrings.dashboardContent).classList.remove('hidden');
            }, 1000);
            
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
            document.querySelector(DOMstrings.greetingText).textContent = `${greeting}, ${username}!`;
            document.querySelector(DOMstrings.currentDate).textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        },

        flipAuthCard: (to) => {
            const card = document.querySelector(DOMstrings.flipCard);
            if (to === 'register') card.classList.add('flipped');
            else card.classList.remove('flipped');
        },

        setAuthFeedback: (form, message, isSuccess = false) => {
            const el = document.querySelector(form === 'login' ? DOMstrings.loginFeedback : DOMstrings.registerFeedback);
            el.textContent = message;
            el.classList.toggle('text-green-600', isSuccess);
            el.classList.toggle('text-red-600', !isSuccess);
        },
        
        toggleButtonState: (button, text, disabled) => {
            button.textContent = text;
            button.disabled = disabled;
        },

        updateWeatherUI: (data, errorMsg = null) => {
            if(errorMsg) {
                 document.getElementById('weather-desc').innerText = errorMsg;
                 return;
            }
            document.getElementById('weather-icon').className = `bx ${data.icon} text-5xl text-yellow-400`;
            document.getElementById('weather-temp').innerText = `${data.temp}°C`;
            document.getElementById('weather-desc').innerText = data.description;
            document.getElementById('weather-humidity').innerText = `${data.humidity}%`;
            document.getElementById('weather-wind').innerText = `${data.wind} km/h`;
            document.getElementById('weather-city').innerText = `${data.name}, IN`;
        },

        renderSensorData: (data) => {
            Utils.animateValue('temp-val', data.temperature);
            Utils.animateValue('hum-val', data.humidity);
            Utils.animateValue('soil-val', data.soilMoisture);
            
            if(liveChart) {
                const timeLabel = new Date().toLocaleTimeString();
                if(liveChart.data.labels.length > 20) {
                    liveChart.data.labels.shift();
                    liveChart.data.datasets.forEach(ds => ds.data.shift());
                }
                liveChart.data.labels.push(timeLabel);
                liveChart.data.datasets[0].data.push(data.temperature);
                liveChart.data.datasets[1].data.push(data.humidity);
                liveChart.data.datasets[2].data.push(data.soilMoisture);
                liveChart.update();
                document.getElementById('sensor-history-body').insertAdjacentHTML('afterbegin', `<tr><td class="p-2">${timeLabel}</td><td>${data.temperature}°C</td><td>${data.humidity}%</td><td>${data.soilMoisture}%</td></tr>`);
                document.getElementById('last-update-time').textContent = timeLabel;
            }
        },

        renderHealthScore: ({ score, status, color, icon }) => {
            document.querySelector(DOMstrings.healthScore).innerText = `${score}%`;
            const statusEl = document.querySelector(DOMstrings.healthStatus);
            statusEl.innerText = status;
            statusEl.className = `font-semibold ${color}`;
            document.querySelector(DOMstrings.healthIcon).className = `bx ${icon} text-6xl ${color}`;
        },
        
        applyTheme: (theme) => {
            currentTheme = theme;
            document.body.className = theme;
            localStorage.setItem('theme', theme);
            updateChartTheme();
        },

        setSystemStatus: (status) => {
            const indicator = document.getElementById('system-status-indicator');
            const text = document.getElementById('system-status-text');
            const chartOverlay = document.getElementById('chart-overlay');
            indicator.classList.remove('animate-pulse');

            if (status === 'online') {
                indicator.className = 'w-4 h-4 rounded-full bg-green-500';
                text.textContent = 'Online';
                chartOverlay.classList.add('hidden');
                chartOverlay.classList.remove('flex');
            } else if (status === 'disconnected') {
                indicator.className = 'w-4 h-4 rounded-full bg-red-500';
                text.textContent = 'Disconnected';
                chartOverlay.classList.remove('hidden');
                chartOverlay.classList.add('flex');
            } else {
                indicator.className = 'w-4 h-4 rounded-full bg-yellow-400 animate-pulse';
                text.textContent = 'Connecting...';
                chartOverlay.classList.add('hidden');
                chartOverlay.classList.remove('flex');
            }
        },

        showSection: (sectionId) => {
            ['dashboard', 'history', 'controls', 'settings'].forEach(id => {
                document.getElementById(`${id}-section`)?.classList.add('hidden');
            });
            document.getElementById(`${sectionId}-section`)?.classList.remove('hidden');
            
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
            });

            if (window.innerWidth < 1024) {
                document.getElementById('app-container').classList.remove('sidebar-mobile-open');
            }
        },

        toggleSidebar: () => {
            const appContainer = document.getElementById('app-container');
            if (window.innerWidth < 1024) {
                appContainer.classList.toggle('sidebar-mobile-open');
            } else {
                appContainer.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', appContainer.classList.contains('sidebar-collapsed'));
            }
        },

        openModal: (src, type) => {
            if (type === 'image') {
                document.getElementById('modal-img').src = src;
                document.getElementById('image-modal').classList.remove('hidden');
            } else if (type === 'profile') {
                document.getElementById('add-profile-modal').classList.remove('hidden');
            }
        },

        closeModal: (type) => {
            if (type === 'image') {
                document.getElementById('image-modal').classList.add('hidden');
            } else if (type === 'profile') {
                document.getElementById('add-profile-modal').classList.add('hidden');
            }
        },

        populatePlantDropdown: (profiles, callback) => {
            const dropdown = document.getElementById('plant-dropdown');
            const searchInput = document.getElementById('plant-search-input');
            const filter = searchInput.value;
            
            dropdown.innerHTML = Object.keys(profiles)
                .filter(p => p.toLowerCase().includes(filter.toLowerCase()))
                .map(p => `<a href="#" data-plant-name="${p}" class="plant-select-item block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">${p}</a>`).join('');

            document.querySelectorAll('.plant-select-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const plantName = e.target.dataset.plantName;
                    callback(plantName);
                });
            });
        },

        selectPlant: (plantName) => {
            document.getElementById('plant-search-input').value = plantName;
            document.getElementById('plant-dropdown').classList.add('hidden');
        }
    };
})();