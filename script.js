
    const firebaseConfig = {
        apiKey: "AIzaSyBsFkCtWkTu_pO2q6iCYgUwRCko4rf6Mb8", authDomain: "hackthon-3275c.firebaseapp.com", projectId: "hackthon-3275c", storageBucket: "hackthon-3275c.appspot.com", messagingSenderId: "316037626448", appId: "1:316037626448:web:d2994417d0d3b4b28f6f55", databaseURL: "https://hackthon-3275c-default-rtdb.firebaseio.com/"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const auth = app.auth(); 
    const db = app.firestore(); 
    const rtdb = app.database(); 

    let liveChart;
    let currentTheme = localStorage.getItem('theme') || 'light';
    let currentData = { temperature: 0, humidity: 0, soilMoisture: 0, lightIntensity: 0 };
    let plantProfiles = { "Default (General)": { temp: [18, 29], humidity: [50, 70], soil: [40, 80], light: [5000, 20000] } };
    let activeProfile = plantProfiles["Default (General)"];
    let systemHealthTimeout;
    let lastImageTimestamp = 0;
    
    const gardeningTips = [
        "Most plants need about 1 inch of water per week.",
        "Check the soil moisture before watering to avoid overwatering.",
        "Rotate your indoor plants regularly to ensure all sides get sunlight.",
        "Fertilize your plants during their growing season (spring and summer).",
        "Pruning dead leaves helps your plant focus its energy on new growth.",
        "Ensure your pots have drainage holes to prevent root rot."
    ];
    
    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(currentTheme);
        document.getElementById('dark-mode-toggle').checked = currentTheme === 'dark';
        document.getElementById('dark-mode-toggle').addEventListener('change', toggleTheme);
        createLeafParticles();
        if (localStorage.getItem('sidebarCollapsed') === 'true') document.getElementById('app-container').classList.add('sidebar-collapsed');
        
        const searchInput = document.getElementById('plant-search-input');
        const dropdown = document.getElementById('plant-dropdown');
        searchInput.addEventListener('keyup', () => populatePlantDropdown(searchInput.value));
        searchInput.addEventListener('focus', () => dropdown.classList.remove('hidden'));
        document.addEventListener('click', (e) => {
            const profileContainer = document.getElementById('plant-profile-container');
            if (profileContainer && !profileContainer.contains(e.target)) dropdown.classList.add('hidden');
        });

        auth.onAuthStateChanged(user => {
            if (user) {
                showTipsPage();
                const fetchData = db.collection("users").doc(user.uid).get();
                const timer = new Promise(resolve => setTimeout(resolve, 5000));

                Promise.all([fetchData, timer]).then(([docSnapshot]) => {
                    const username = docSnapshot.exists ? docSnapshot.data().name : user.displayName || "User";
                    hideTipsPageAndShowDashboard(username);
                }).catch(err => {
                    console.warn("Could not fetch user document, possibly offline.", err);
                    timer.then(() => {
                        hideTipsPageAndShowDashboard(user.displayName || "User");
                    });
                });
            } else {
                showLogin();
            }
        });
    });

    function showTipsPage() {
        const tipsPage = document.getElementById('tips-page');
        const tipEl = document.getElementById('gardening-tip');
        const authContainer = document.getElementById('auth-container');
        
        authContainer.classList.add('hidden');
        tipsPage.classList.remove('hidden');
        tipsPage.style.opacity = '1';
        tipEl.textContent = gardeningTips[Math.floor(Math.random() * gardeningTips.length)];
    }

    function hideTipsPageAndShowDashboard(username) {
        const tipsPage = document.getElementById('tips-page');
        tipsPage.style.opacity = '0';
        setTimeout(() => {
            tipsPage.classList.add('hidden');
            showDashboard(username);
        }, 500);
    }


    function loginWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then(result => {
            const user = result.user;
            const userDocRef = db.collection("users").doc(user.uid);
            return userDocRef.get().then(doc => {
                if (!doc.exists) return userDocRef.set({ name: user.displayName, email: user.email, createdAt: new Date() });
            });
        }).catch(error => showToast(`Google login failed: ${error.message}`, 'error'));
    }

    function showLogin() {
        document.getElementById('dashboard-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    }

    function showDashboard(username) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        if (!dashboardInitialized) initDashboard(username);
    }
    
    function login() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const feedback = document.getElementById('login-feedback');
        if (!email || !password) return feedback.textContent = 'Please enter email and password.';
        const button = document.getElementById('login-button');
        button.disabled = true; button.textContent = 'Logging in...';
        auth.signInWithEmailAndPassword(email, password).catch(err => feedback.textContent = 'Invalid email or password.')
        .finally(() => { button.disabled = false; button.textContent = 'Login'; });
    }

    function register() {
        const name = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const feedback = document.getElementById('register-feedback');
        if (!name || !email || !password) return feedback.textContent = 'Please fill all fields.';
        if (password.length < 6) return feedback.textContent = 'Password must be at least 6 characters.';
        const button = document.getElementById('register-button');
        button.disabled = true; button.textContent = 'Registering...';
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection("users").doc(cred.user.uid).set({ name, email, createdAt: new Date() }))
            .catch(err => feedback.textContent = err.code === 'auth/email-already-in-use' ? 'This email is already registered.' : 'Registration failed.')
            .finally(() => { button.disabled = false; button.textContent = 'Register'; });
    }

    function logout() { 
        dashboardInitialized = false;
        auth.signOut(); 
        document.getElementById('sensor-history-body').innerHTML = '';
        document.getElementById('sprinkler-log-body').innerHTML = '';
        document.getElementById('image-history-gallery').innerHTML = '<div class="text-gray-400 col-span-full text-center p-8"><i class="bx bx-image-alt text-5xl mb-2"></i><p>No images received yet.</p></div>';
        document.getElementById('last-snapshot-img').src = 'https://placehold.co/400x300/e2e8f0/e2e8f0?text=Waiting+for+image...';
        document.getElementById('last-snapshot-time').textContent = '--';
        document.getElementById('notifications-list').innerHTML = '<li class="text-gray-400">No new notifications.</li>';
        ['temp-val', 'hum-val', 'soil-val', 'light-val'].forEach(id => document.getElementById(id).textContent = '--');
    }
    
    let dashboardInitialized = false;
    async function initDashboard(username) {
        if (dashboardInitialized) return;
        dashboardInitialized = true;
        updateGreeting(username);
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        await loadUserProfiles();
        populatePlantDropdown();
        selectPlant("Default (General)");
        initChart();
        fetchWeather();
        setupRealtimeListener();
        setupImageListener();
        setTimeout(() => {
            document.getElementById('skeleton-loader').classList.add('hidden');
            document.getElementById('dashboard-content').classList.remove('hidden');
        }, 500);
    }

    function updateGreeting(username) {
        const hour = new Date().getHours();
        document.getElementById('greeting-text').textContent = `${hour<12?'Good Morning':hour<18?'Good Afternoon':'Good Evening'}, ${username}!`;
    }

    function setSystemStatus(status) {
        const indicator = document.getElementById('system-status-indicator');
        const text = document.getElementById('system-status-text');
        const overlay = document.getElementById('chart-overlay');
        indicator.classList.remove('animate-pulse');
        if (status === 'online') {
            indicator.className = 'w-4 h-4 rounded-full bg-green-500';
            text.textContent = 'Online';
            overlay.classList.add('hidden'); overlay.classList.remove('flex');
        } else {
            indicator.className = 'w-4 h-4 rounded-full bg-red-500';
            text.textContent = 'Disconnected';
            overlay.classList.remove('hidden'); overlay.classList.add('flex');
        }
    }

    function setupRealtimeListener() {
        const logsQuery = rtdb.ref('/logs').orderByKey().limitToLast(1);
        logsQuery.on('child_added', snapshot => {
            clearTimeout(systemHealthTimeout);
            setSystemStatus('online');
            const data = snapshot.val();
            if (data && typeof data.temperature !== 'undefined') {
                const formatted = {
                    temperature: parseFloat(data.temperature.toFixed(1)),
                    humidity: parseFloat(data.humidity.toFixed(1)),
                    soilMoisture: convertToPercentage(data.soil_moisture, 4095, 1800),
                    lightIntensity: Math.round(data.light_intensity) || 0
                };
                handleRealData(formatted);
            }
            systemHealthTimeout = setTimeout(() => setSystemStatus('disconnected'), 15000); 
        }, err => { console.error(err); setSystemStatus('disconnected'); });
    }
    
    function convertToPercentage(raw, max, min) {
        return Math.max(0, Math.min(100, Math.round(100 * (max - raw) / (max - min))));
    }
    
    let lastProcessedTimestamp = null;
    function handleRealData(data) {
        const timeLabel = new Date().toLocaleTimeString();
        currentData = data;
        
        animateValue('temp-val', data.temperature);
        animateValue('hum-val', data.humidity);
        animateValue('soil-val', data.soilMoisture);
        animateValue('light-val', data.lightIntensity);
        
        const healthInfo = calculateHealthScore(data);
        updateHealthScoreUI(healthInfo);
        updateNotifications(healthInfo.issues);

        if (timeLabel !== lastProcessedTimestamp) {
            lastProcessedTimestamp = timeLabel;
            if(liveChart.data.labels.length > 20) {
                liveChart.data.labels.shift();
                liveChart.data.datasets.forEach(ds => ds.data.shift());
            }
            liveChart.data.labels.push(timeLabel);
            liveChart.data.datasets[0].data.push(data.temperature);
            liveChart.data.datasets[1].data.push(data.humidity);
            liveChart.data.datasets[2].data.push(data.soilMoisture);
            liveChart.data.datasets[3].data.push(data.lightIntensity);
            liveChart.update();
            document.getElementById('sensor-history-body').insertAdjacentHTML('afterbegin', `<tr><td class="p-2">${timeLabel}</td><td>${data.temperature}°C</td><td>${data.humidity}%</td><td>${data.soilMoisture}%</td><td>${data.lightIntensity} lux</td></tr>`);
        }
        document.getElementById('last-update-time').textContent = timeLabel;
    }

    function setupImageListener() {
        const imageQuery = rtdb.ref('/images').orderByKey();
        
        imageQuery.limitToLast(12).once('value', snapshot => {
            const imageHistory = snapshot.val();
            if (imageHistory) {
                const gallery = document.getElementById('image-history-gallery');
                gallery.innerHTML = ''; 
                Object.values(imageHistory).reverse().forEach((imgData, index) => {
                    if (imgData.base64 && imgData.timestamp) {
                        if (index === 0) updateLastSnapshot(imgData);
                        addImageToGallery(imgData);
                        lastImageTimestamp = Math.max(lastImageTimestamp, imgData.timestamp);
                    }
                });
            }
        });

        imageQuery.limitToLast(1).on('child_added', snapshot => {
            const imageData = snapshot.val();
            if (imageData && imageData.base64 && imageData.timestamp) {
                if (imageData.timestamp > lastImageTimestamp) {
                    updateLastSnapshot(imageData);
                    addImageToGallery(imageData);
                    lastImageTimestamp = imageData.timestamp;
                }
            }
        });
    }

    function updateLastSnapshot(imageData) {
        document.getElementById('last-snapshot-img').src = `data:image/jpeg;base64,${imageData.base64}`;
        document.getElementById('last-snapshot-time').textContent = new Date(imageData.timestamp).toLocaleString();
    }

    function addImageToGallery(imageData) {
        const gallery = document.getElementById('image-history-gallery');
        const imageUrl = `data:image/jpeg;base64,${imageData.base64}`;
        const timestamp = new Date(imageData.timestamp).toLocaleString();
        const imageEl = document.createElement('div');
        imageEl.className = 'relative group';
        imageEl.innerHTML = `
            <img src="${imageUrl}" alt="Plant Snapshot" class="w-full h-auto rounded-lg cursor-pointer object-cover aspect-square" onclick="openModal('${imageUrl}')">
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">${timestamp}</div>
        `;
        if (gallery.querySelector('.text-gray-400')) gallery.innerHTML = '';
        gallery.prepend(imageEl);
    }


    function toggleSidebar() {
        const container = document.getElementById('app-container');
        if (window.innerWidth < 1024) container.classList.toggle('sidebar-mobile-open');
        else {
            container.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', container.classList.contains('sidebar-collapsed'));
        }
    }

    function showSection(id) {
        ['dashboard','history','controls','settings'].forEach(s=>document.getElementById(`${s}-section`)?.classList.add('hidden'));
        document.getElementById(`${id}-section`).classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(l=>l.classList.toggle('active',l.getAttribute('href')===`#${id}`));
        if (window.innerWidth < 1024) document.getElementById('app-container').classList.remove('sidebar-mobile-open');
    }
    
    function flipToRegister() { document.getElementById('flip-card').classList.add('flipped'); }
    function flipToLogin() { document.getElementById('flip-card').classList.remove('flipped'); }
    function applyTheme(theme) { document.body.className = theme; localStorage.setItem('theme', theme); currentTheme = theme; if (liveChart) updateChartTheme(); }
    function toggleTheme() { applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'); }
    function openModal(src) { document.getElementById('modal-img').src=src; document.getElementById('image-modal').classList.remove('hidden'); }
    function closeModal() { document.getElementById('image-modal').classList.add('hidden'); }
    function openProfileModal() { document.getElementById('add-profile-modal').classList.remove('hidden'); }
    function closeProfileModal() { document.getElementById('add-profile-modal').classList.add('hidden'); }
    
    async function saveNewProfile() {
        const name = document.getElementById('new-plant-name').value.trim();
        const values = ['temp-min','temp-max','humidity-min','humidity-max','soil-min','soil-max','light-min','light-max'].map(id => parseFloat(document.getElementById('new-' + id).value));
        if (!name || values.some(isNaN)) return showToast('Please fill all fields correctly.', 'error');
        if (plantProfiles[name]) return showToast('A profile with this name already exists.', 'error');
        
        const userId = auth.currentUser?.uid;
        if (!userId) return showToast('You must be logged in to save profiles.', 'error');

        const newProfile = { temp: values.slice(0,2), humidity: values.slice(2,4), soil: values.slice(4,6), light: values.slice(6,8) };
        try {
            await db.collection('users').doc(userId).collection('plantProfiles').doc(name).set(newProfile);
            plantProfiles[name] = newProfile;
            closeProfileModal();
            populatePlantDropdown();
            selectPlant(name);
            showToast('New profile saved!', 'success');
        } catch (error) { showToast('Failed to save profile.', 'error'); }
    }

    async function loadUserProfiles() {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            const snapshot = await db.collection('users').doc(userId).collection('plantProfiles').get();
            snapshot.forEach(doc => { plantProfiles[doc.id] = doc.data(); });
        } catch (error) { showToast('Could not load your saved profiles.', 'error'); }
    }

    function populatePlantDropdown(filter = '') {
        const dropdown = document.getElementById('plant-dropdown');
        dropdown.innerHTML = Object.keys(plantProfiles)
            .filter(p => p.toLowerCase().includes(filter.toLowerCase()))
            .map(p => `<a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700" onclick="event.preventDefault(); selectPlant('${p}')">${p}</a>`).join('');
    }
    function selectPlant(plantName) {
        document.getElementById('plant-search-input').value = plantName;
        document.getElementById('plant-dropdown').classList.add('hidden');
        activeProfile = plantProfiles[plantName];
        if (currentData.temperature !== 0) {
            const healthInfo = calculateHealthScore(currentData);
            updateHealthScoreUI(healthInfo);
            updateNotifications(healthInfo.issues);
        }
    }
    
    function initChart() {
        const ctx = document.getElementById('live-chart').getContext('2d');
        liveChart = new Chart(ctx, { 
            type: 'line', 
            data: { labels: [], datasets: [ 
                { label: 'Temp', data: [], borderColor: '#ef4444', tension: 0.3, yAxisID: 'yTemp' }, 
                { label: 'Humidity', data: [], borderColor: '#3b82f6', tension: 0.3, yAxisID: 'yPercent' }, 
                { label: 'Soil', data: [], borderColor: '#ca8a04', tension: 0.3, yAxisID: 'yPercent' },
                { label: 'Light', data: [], borderColor: '#f59e0b', tension: 0.3, yAxisID: 'yLight' }
            ] }, 
            options: { responsive: true, maintainAspectRatio: false, scales: { 
                x: {}, 
                yTemp: { type: 'linear', position: 'left', title: { display: true, text: '°C' } }, 
                yPercent: { type: 'linear', position: 'right', title: { display: true, text: '%' }, min: 0, max: 100, grid: { drawOnChartArea: false } },
                yLight: { type: 'linear', position: 'right', title: { display: true, text: 'lux'}, grid: { drawOnChartArea: false } }
            } } 
        });
        updateChartTheme();
    }
    function updateChartTheme() {
        if (!liveChart) return;
        const isDark = currentTheme === 'dark';
        const color = isDark ? '#e5e7eb' : '#1f2937';
        liveChart.options.scales.x.ticks.color = color;
        liveChart.options.plugins.legend.labels.color = color;
        liveChart.options.scales.yTemp.ticks.color = '#ef4444';
        liveChart.options.scales.yTemp.title.color = '#ef4444';
        liveChart.options.scales.yPercent.ticks.color = '#3b82f6';
        liveChart.options.scales.yPercent.title.color = '#3b82f6';
        liveChart.options.scales.yLight.ticks.color = '#f59e0b';
        liveChart.options.scales.yLight.title.color = '#f59e0b';
        liveChart.update();
    }

    function calculateHealthScore({ temperature, humidity, soilMoisture, lightIntensity }) {
        let score = 100;
        const issues = [];
        const check = (val, range, highMsg, lowMsg) => {
            if (!range) return;
            if (val > range[1]) {
                score -= 25;
                issues.push(highMsg);
            } else if (val < range[0]) {
                score -= 25;
                issues.push(lowMsg);
            }
        };
        check(temperature, activeProfile.temp, "🌡️ Temperature is too high!", "🌡️ Temperature is too low!");
        check(humidity, activeProfile.humidity, "💧 Humidity is too high!", "💧 Humidity is too low!");
        check(soilMoisture, activeProfile.soil, "🌱 Soil is too wet. Don't overwater!", "🌱 Soil is too dry. Time to water!");
        check(lightIntensity, activeProfile.light, "☀️ Light is too bright!", "☀️ Light is too dim!");
        
        score = Math.max(0, Math.round(score));
        let status, color, icon;
        if (score >= 85) { status = 'Excellent'; color = 'text-green-500'; icon = 'bx-happy-heart-eyes'; }
        else if (score >= 60) { status = 'Good'; color = 'text-yellow-500'; icon = 'bx-happy-alt'; }
        else { status = 'Warning'; color = 'text-red-500'; icon = 'bx-sad'; }
        
        return { score, status, color, icon, issues };
    }
    
    function updateHealthScoreUI({score, status, color, icon}) {
        document.getElementById('health-score').innerText = `${score}%`;
        const statusEl = document.getElementById('health-status');
        statusEl.innerText = status;
        statusEl.className = `font-semibold ${color}`;
        document.getElementById('health-icon').className = `bx ${icon} text-6xl ${color}`;
    }
    
    function updateNotifications(issues) {
        const notificationsList = document.getElementById('notifications-list');
        notificationsList.innerHTML = '';
        if (issues.length === 0) {
            notificationsList.innerHTML = '<li class="text-gray-400 flex items-center gap-2"><i class="bx bx-check-circle text-green-500"></i>All conditions are optimal.</li>';
        } else {
            notificationsList.innerHTML = issues.map(msg => `<li class="flex items-center gap-2">${msg}</li>`).join('');
        }
    }

    function animateValue(id, end) {
        const el = document.getElementById(id); if (!el) return;
        const start = parseFloat(el.textContent) || 0; if (start === end) return;
        let startTimestamp;
        const step = ts => {
            if (!startTimestamp) startTimestamp = ts;
            const progress = Math.min((ts - startTimestamp) / 500, 1);
            el.textContent = (progress * (end - start) + start).toFixed(id.includes('light') ? 0 : 1);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function createLeafParticles() {
        const container = document.getElementById('leaf-particle-container'); if (!container) return;
        for (let i = 0; i < 30; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf-particle';
            leaf.textContent = ['🌿','🍃','🌱','☘️'][Math.floor(Math.random()*4)];
            leaf.style.left = `${Math.random() * 100}vw`;
            leaf.style.animationDuration = `${15 + Math.random() * 10}s`;
            leaf.style.animationDelay = `${Math.random() * 15}s`;
            container.appendChild(leaf);
        }
    }
    
    async function fetchWeather() {
        const apiKey = '405aa3ba9bf38d8ea04f974bedfca150';
        const process = async (lat, lon, city = null) => {
            try {
                const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Weather data not available');
                updateWeatherUI(await response.json(), city);
            } catch (error) { document.getElementById('weather-desc').innerText = 'Weather unavailable'; }
        };
        const success = pos => process(pos.coords.latitude, pos.coords.longitude);
        const error = () => process(28.6139, 77.2090, "Delhi"); 
        navigator.geolocation.getCurrentPosition(success, error);
    }

    function updateWeatherUI(data, fallbackCity = null) {
        const { main, weather, name } = data;
        const temp = Math.round(main.temp);
        const description = weather[0].main;
        document.getElementById('weather-icon').className = `bx ${getWeatherIcon(weather[0].id)} text-5xl text-yellow-400`;
        document.getElementById('weather-temp').innerText = `${temp}°C`;
        document.getElementById('weather-desc').innerText = description;
        document.getElementById('weather-city').innerText = fallbackCity || name;
        const alertsContainer = document.getElementById('weather-alerts-container');
        alertsContainer.innerHTML = '';
        if (temp > 35) {
            alertsContainer.innerHTML = `<div class="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 flex items-center gap-2"><i class='bx bxs-hot'></i> <span class="font-semibold">High Heat Alert:</span> Paudhon ko paani dein.</div>`;
        } else if (description.toLowerCase().includes('rain') || description.toLowerCase().includes('storm')) {
            alertsContainer.innerHTML = `<div class="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 flex items-center gap-2"><i class='bx bxs-cloud-rain'></i> <span class="font-semibold">Rain Alert:</span> Paudhon ko zyada paani na dein.</div>`;
        }
    }

    function getWeatherIcon(id) {
        if (id < 300) return 'bxs-thunder-house'; if (id < 600) return 'bxs-rain'; if (id < 700) return 'bxs-snow'; if (id < 800) return 'bxs-layer'; if (id === 800) return 'bxs-sun'; return 'bxs-cloud';
    }
    
    function manualSpray() {
        const duration = parseInt(document.getElementById('spray-duration').value, 10);
        if (isNaN(duration) || duration <= 0) return showToast("Please enter a valid duration.", "error");
        rtdb.ref('commands/spray').set({ duration, timestamp: Date.now() });
        showToast(`Sprinkler command sent for ${duration} seconds.`, 'success');
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
