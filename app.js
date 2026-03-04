// AvisadorGPS Core Logic

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed', err));
    });
}


let map, userMarker, destinationMarker, destinationCircle;
let watchId = null;
let alarmActive = false;
let destination = null;
let alarmSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alarmSound.loop = true;

// UI Elements
const statusBadge = document.getElementById('status-badge');
const distanceValue = document.getElementById('distance-value');
const radiusInput = document.getElementById('radius');
const radiusLabel = document.getElementById('radius-label');
const setAlarmBtn = document.getElementById('set-alarm');
const cancelAlarmBtn = document.getElementById('cancel-alarm');
const alarmOverlay = document.getElementById('alarm-overlay');
const stopAlarmBtn = document.getElementById('stop-alarm');

function initMap() {
    // Default to Buenos Aires if no location
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([-34.6037, -58.3816], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e) => {
        if (!alarmActive) {
            setDestination(e.latlng);
        }
    });

    // Try to get current location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            map.setView(latlng, 15);
            updateUserMarker(latlng);
        });
    }
}

function updateUserMarker(latlng) {
    if (!userMarker) {
        const userIcon = L.divIcon({
            className: 'user-location-icon',
            html: '<div class="pulse-marker"></div>',
            iconSize: [20, 20]
        });
        userMarker = L.marker(latlng, { icon: userIcon }).addTo(map);
    } else {
        userMarker.setLatLng(latlng);
    }
}

function setDestination(latlng) {
    destination = latlng;
    const radius = radiusInput.value;

    if (destinationMarker) {
        destinationMarker.setLatLng(latlng);
        destinationCircle.setLatLng(latlng);
        destinationCircle.setRadius(radius);
    } else {
        destinationMarker = L.marker(latlng, { draggable: true }).addTo(map);
        destinationCircle = L.circle(latlng, {
            radius: radius,
            color: '#22d3ee',
            fillColor: '#22d3ee',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        destinationMarker.on('drag', (e) => {
            destination = e.target.getLatLng();
            destinationCircle.setLatLng(destination);
            updateStatus();
        });
    }
    updateStatus();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function updateStatus() {
    if (!userMarker || !destination) {
        distanceValue.innerText = "-- m";
        return;
    }

    const userPos = userMarker.getLatLng();
    const dist = calculateDistance(userPos.lat, userPos.lng, destination.lat, destination.lng);

    distanceValue.innerText = dist > 1000
        ? (dist / 1000).toFixed(2) + " km"
        : Math.round(dist) + " m";

    if (alarmActive && dist <= radiusInput.value) {
        triggerAlarm();
    }
}

function triggerAlarm() {
    alarmOverlay.classList.remove('hidden');
    alarmSound.play().catch(e => console.error("Error playing sound:", e));
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);

    // Simple notification if supported
    if (Notification.permission === "granted") {
        new Notification("¡Llegaste!", {
            body: "Estás dentro del radio de aviso.",
            icon: "icon.png"
        });
    }
}

function startTracking() {
    if (!destination) {
        alert("Por favor, selecciona un destino en el mapa.");
        return;
    }

    if ("geolocation" in navigator) {
        alarmActive = true;
        setAlarmBtn.classList.add('hidden');
        cancelAlarmBtn.classList.remove('hidden');
        statusBadge.innerText = "Alerta Activa";
        statusBadge.style.color = "#22d3ee";

        watchId = navigator.geolocation.watchPosition(
            pos => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                updateUserMarker(latlng);
                updateStatus();
                statusBadge.innerText = "GPS OK";
            },
            err => {
                console.error(err);
                statusBadge.innerText = "Error GPS";
            },
            { enableHighAccuracy: true }
        );

        // Request notification permission
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    alarmActive = false;
    setAlarmBtn.classList.remove('hidden');
    cancelAlarmBtn.classList.add('hidden');
    statusBadge.innerText = "Alerta Cancelada";
    statusBadge.style.color = "";
    alarmSound.pause();
    alarmSound.currentTime = 0;
    alarmOverlay.classList.add('hidden');
}

// Event Listeners
radiusInput.addEventListener('input', (e) => {
    const val = e.target.value;
    radiusLabel.innerText = val + "m";
    if (destinationCircle) destinationCircle.setRadius(val);
    updateStatus();
});

setAlarmBtn.addEventListener('click', startTracking);
cancelAlarmBtn.addEventListener('click', stopTracking);
stopAlarmBtn.addEventListener('click', stopTracking);

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', initMap);

// Add custom marker style
const style = document.createElement('style');
style.textContent = `
    .pulse-marker {
        width: 16px;
        height: 16px;
        background: #22d3ee;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 10px var(--primary-glow);
    }
`;
document.head.appendChild(style);
