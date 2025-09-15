// js/firebaseService.js

const firebaseService = (() => {
    // --- Single Firebase Configuration for your "agronexus-9241c" project ---
    const firebaseConfig = {
        apiKey: "AIzaSyBd1LQz4kAlhdi3YeGRchChhS6vFk_7G9U",
        authDomain: "agronexus-9241c.firebaseapp.com",
        databaseURL: "https://agronexus-9241c-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "agronexus-9241c",
        storageBucket: "agronexus-9241c.appspot.com", // Corrected to .appspot.com which is standard
        messagingSenderId: "407720245634",
        appId: "1:407720245634:web:19daac2acf547e2b6c379b",
        measurementId: "G-9XREDQVBNE"
    };

    // --- Single Firebase Initialization ---
    // We only need to initialize the app once.
    const app = firebase.initializeApp(firebaseConfig);

    // --- Unified Service References ---
    // All services now come from the same, single app instance.
    const auth = app.auth();
    const db = app.firestore();
    const rtdb = app.database();

    return {
        // AUTH METHODS (These remain the same)
        onAuthStateChanged: (callback) => auth.onAuthStateChanged(callback),
        login: (email, password) => auth.signInWithEmailAndPassword(email, password),
        register: (email, password) => auth.createUserWithEmailAndPassword(email, password),
        logout: () => auth.signOut(),

        // FIRESTORE METHODS (These remain the same)
        getUserProfile: (uid) => db.collection("users").doc(uid).get(),
        createUserProfile: (uid, data) => db.collection("users").doc(uid).set(data),
        
        // REALTIME DATABASE METHODS (Updated to use the unified rtdb)
        listenToSensorLogs: (callback) => {
      // FIX: Changed the path to 'logs' to match what your ESP32 is using.
         const path = 'logs';
         rtdb.ref(path).on('value', snapshot => callback(snapshot.val()));
        },
        
        sendCommand: (command, payload) => {
            // This sends commands to a 'commands' path in your RTDB
            return rtdb.ref(`commands/${command}`).set({ ...payload, timestamp: Date.now() });
        }
    };
})();