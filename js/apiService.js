const apiService = {
    fetchWeather: async (uiCallback) => {
        const apiKey = '405aa3ba9bf38d8ea04f974bedfca150';

        const getWeatherData = async (url, cityName = null) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Weather data not found');
                const data = await response.json();
                const { main, weather, wind, name } = data;
                
                const weatherData = { 
                    temp: Math.round(main.temp), 
                    description: weather[0].main, 
                    icon: Utils.getWeatherIcon(weather[0].id), 
                    humidity: main.humidity, 
                    wind: Math.round(wind.speed * 3.6), 
                    name: cityName || name 
                };
                uiCallback.updateWeatherUI(weatherData);
            } catch (error) {
                console.error("Weather fetch error:", error);
                uiCallback.updateWeatherUI(null, 'Weather unavailable');
            }
        };

        const locationSuccess = pos => {
            getWeatherData(`https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${apiKey}&units=metric`);
        };
        const locationError = () => {
            getWeatherData(`https://api.openweathermap.org/data/2.5/weather?q=Meerut&appid=${apiKey}&units=metric`, "Meerut");
        };

        navigator.geolocation.getCurrentPosition(locationSuccess, locationError);
    }
};