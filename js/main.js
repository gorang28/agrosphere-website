const App = ((ui, fire, api, utils) => {

    // --- APPLICATION STATE ---
    let state = {
        currentUser: null,
        currentSensorData: null,
        plantProfiles: {
            "Default (General)": { temp: [18, 29], humidity: [50, 70], soil: [40, 80] },
            "Tomato": { temp: [21, 27], humidity: [65, 85], soil: [60, 80] },
            "Orchid": { temp: [24, 29], humidity: [40, 70], soil: [30, 50] },
        },
        activeProfile: null,
        systemHealthTimeout: null,
        lastDataTimestamp: null
    };

    // --- EVENT LISTENERS ---
    const setupEventListeners = () => {
        const DOM = ui.getDOMstrings();
        
        // Auth
        document.getElementById('login-button').addEventListener('click', loginUser);
        document.getElementById('register-button').addEventListener('click', registerUser);
        document.getElementById('flip-to-register').addEventListener('click', (e) => { e.preventDefault(); ui.flipAuthCard('register'); });
        document.getElementById('flip-to-login').addEventListener('click', (e) => { e.preventDefault(); ui.flipAuthCard('login'); });
        document.getElementById('logout-button').addEventListener('click', (e) => { e.preventDefault(); fire.logout(); });
        
        // Modals
        document.getElementById('add-profile-button').addEventListener('click', () => ui.openModal(null, 'profile'));
        document.getElementById('close-profile-modal').addEventListener('click', () => ui.closeModal('profile'));
        document.getElementById('image-modal').addEventListener('click', () => ui.closeModal('image'));
        document.getElementById('last-snapshot-img').addEventListener('click', (e) => ui.openModal(e.target.src, 'image'));

        // Sidebar
        document.getElementById('sidebar-toggle-mobile').addEventListener('click', ui.toggleSidebar);
        document.getElementById('sidebar-toggle-desktop').addEventListener('click', ui.toggleSidebar);
        document.getElementById('mobile-overlay').addEventListener('click', ui.toggleSidebar);
        document.getElementById('sidebar-nav').addEventListener('click', (e) => {
            const link = e.target.closest('.sidebar-link');
            if (link) {
                e.preventDefault();
                const sectionId = link.getAttribute('href').substring(1);
                ui.showSection(sectionId);
            }
        });

        // Settings
        document.querySelector(DOM.darkModeToggle).addEventListener('change', (e) => {
            ui.applyTheme(e.target.checked ? 'dark' : 'light');
        });

        // Controls
        document.getElementById('manual-spray-button').addEventListener('click', manualSpray);

        // Plant Profile Search
        const searchInput = document.getElementById('plant-search-input');
        const dropdown = document.getElementById('plant-dropdown');
        searchInput.addEventListener('keyup', () => ui.populatePlantDropdown(state.plantProfiles, selectActiveProfile));
        searchInput.addEventListener('focus', () => dropdown.classList.remove('hidden'));
        document.addEventListener('click', (e) => {
            const profileContainer = document.getElementById('plant-profile-container');
            if (profileContainer && !profileContainer.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        document.getElementById('save-profile-button').addEventListener('click', saveNewProfile);
    };
    
    // --- AUTH LOGIC ---
   // REPLACE your old loginUser function with this one

const loginUser = async () => {
    const button = document.getElementById('login-button');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Reset UI
    ui.toggleButtonState(button, 'Logging in...', true);
    ui.setAuthFeedback('login', '');

    if (!email || !password) {
        ui.setAuthFeedback('login', 'Please enter email and password.');
        ui.toggleButtonState(button, 'Login', false);
        return;
    }

    try {
        await fire.login(email, password);
        // On success, the onAuthStateChanged listener will automatically
        // hide the login form and show the dashboard. We don't need to do anything here.
        
    } catch (error) {
        console.error("Login Failed:", error.code, error.message); // For you, the developer
        
        // Provide specific feedback to the user
        let message = 'An error occurred. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                message = 'Invalid email or password. Please try again.';
                break;
            case 'auth/too-many-requests':
                message = 'Access temporarily disabled due to too many failed login attempts.';
                break;
        }
        ui.setAuthFeedback('login', message);
        ui.toggleButtonState(button, 'Login', false);
    }
};
    
// REPLACE your old registerUser function with this one

const registerUser = async () => {
    const button = document.getElementById('register-button');
    const nameInput = document.getElementById('reg-username');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Reset UI
    ui.toggleButtonState(button, 'Registering...', true);
    ui.setAuthFeedback('register', '');

    if (!name || !email || password.length < 6) {
        ui.setAuthFeedback('register', 'Please fill all fields. Password must be 6+ characters.');
        ui.toggleButtonState(button, 'Register', false);
        return;
    }

    try {
        const userCredential = await fire.register(email, password);
        await fire.createUserProfile(userCredential.user.uid, { name, email, createdAt: new Date() });
        
        // Success
        ui.setAuthFeedback('register', 'Success! Please log in.', true);
        
        // Reset the form fields
        nameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';

        setTimeout(() => {
            ui.flipAuthCard('login');
            ui.setAuthFeedback('register', ''); // Clear success message after flip
        }, 2000);

    } catch (error) {
        console.error("Registration Failed:", error.code, error.message);
        const message = error.code === 'auth/email-already-in-use' ? 'This email is already registered.' : 'Registration failed. Please try again.';
        ui.setAuthFeedback('register', message);
    } finally {
        ui.toggleButtonState(button, 'Register', false);
    }
};
    
    

    const handleSensorData = (logs) => {
        clearTimeout(state.systemHealthTimeout);
        ui.setSystemStatus('online');

        if (!logs) {
            console.log("No log data in database, but connection is active.");
            return; 
        }

        const allTimestamps = Object.keys(logs);
        if (allTimestamps.length === 0) return;

        const latestTimestamp = allTimestamps.sort().pop();
        const latestData = logs[latestTimestamp];

        
        if (state.lastDataTimestamp !== latestTimestamp) {
            state.lastDataTimestamp = latestTimestamp;
            
            if (latestData && typeof latestData.temperature !== 'undefined') {
                const formattedData = {
                    temperature: parseFloat(latestData.temperature.toFixed(1)),
                    humidity: parseFloat(latestData.humidity.toFixed(1)),
                    soilMoisture: utils.convertSoilMoistureToPercentage(latestData.soil_moisture)
                };
                
                ui.renderSensorData(formattedData);

                if (state.activeProfile) {
                    const health = utils.calculateHealthScore(formattedData, state.activeProfile);
                    ui.renderHealthScore(health);
                }
            }
        }
        state.systemHealthTimeout = setTimeout(() => {
            console.log("No data received for 15 seconds. Assuming disconnected.");
            ui.setSystemStatus('disconnected');
        }, 15000); 
    };

    // --- APP LOGIC ---
    const selectActiveProfile = (plantName) => {
        state.activeProfile = state.plantProfiles[plantName];
        ui.selectPlant(plantName);
        if (state.currentSensorData) {
            const health = utils.calculateHealthScore(state.currentSensorData, state.activeProfile);
            ui.renderHealthScore(health);
        }
    };
    
    const saveNewProfile = () => {
        const name = document.getElementById('new-plant-name').value.trim();
        const values = ['temp-min', 'temp-max', 'humidity-min', 'humidity-max', 'soil-min', 'soil-max'].map(id => parseFloat(document.getElementById('new-' + id).value));
        
        if (!name || values.some(isNaN)) {
            alert('Please fill all fields correctly.'); 
            return;
        }
        if (state.plantProfiles[name]) { 
            alert('A profile with this name already exists.'); 
            return; 
        }
        
        state.plantProfiles[name] = { temp: values.slice(0,2), humidity: values.slice(2,4), soil: values.slice(4,6) };
        ui.closeModal('profile');
        ui.populatePlantDropdown(state.plantProfiles, selectActiveProfile);
        selectActiveProfile(name);
    };

    const manualSpray = () => {
        const duration = parseInt(document.getElementById('spray-duration').value, 10);
        if (isNaN(duration) || duration <= 0) {
            alert("Please enter a valid, positive number for the duration.");
            return;
        }
        fire.sendCommand('spray', { duration });
        alert(`Sprinkler command sent for ${duration} seconds.`);
    };

    // --- INITIALIZATION ---
    const init = () => {
        console.log('Application has started.');
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        ui.applyTheme(savedTheme);
        document.querySelector(ui.getDOMstrings().darkModeToggle).checked = savedTheme === 'dark';

        if (localStorage.getItem('sidebarCollapsed') === 'true' && window.innerWidth >= 1024) {
            document.getElementById('app-container').classList.add('sidebar-collapsed');
        }

        setupEventListeners();
        utils.createLeafParticles();
        
        fire.onAuthStateChanged(async user => {
            if (user) {
                const profile = await fire.getUserProfile(user.uid);
                state.currentUser = { uid: user.uid, name: profile.exists ? profile.data().name : "User" };
                
                ui.initChart();
                ui.showDashboard(state.currentUser.name);
                api.fetchWeather(ui);
                fire.listenToSensorLogs(handleSensorData);
                selectActiveProfile("Default (General)");
                ui.populatePlantDropdown(state.plantProfiles, selectActiveProfile);

            } else {
                ui.showLogin();
                state.currentUser = null;
            }
        });
    };

    return { init };

})(uiController, firebaseService, apiService, Utils);

// Start the application when the DOM is ready
document.addEventListener('DOMContentLoaded', App.init);