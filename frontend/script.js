// ===================
// GLOBAL VARIABLES
// ===================
let map;
let markers = [];
let reports = [];
let socialPosts = [];
let currentUser = null;
let currentView = 'map';
let otpTimer = null;
let otpCountdown = 60;
let dashboardCharts = {};

// Mock data for demonstration
const mockReports = [
    {
        id: 1,
        type: 'tsunami',
        severity: 5,
        location: [19.0760, 72.8777], // Mumbai
        address: 'Marine Drive, Mumbai',
        description: 'Unusual wave patterns observed',
        timestamp: new Date(Date.now() - 1800000),
        verified: false,
        trustScore: 0.7,
        reporter: 'Anonymous'
    },
    {
        id: 2,
        type: 'cyclone',
        severity: 4,
        location: [13.0827, 80.2707], // Chennai
        address: 'Marina Beach, Chennai',
        description: 'Strong winds and heavy rainfall',
        timestamp: new Date(Date.now() - 3600000),
        verified: true,
        trustScore: 0.9,
        reporter: 'Coast Guard Station'
    },
    {
        id: 3,
        type: 'flooding',
        severity: 3,
        location: [15.2993, 74.1240], // Goa
        address: 'Calangute Beach, Goa',
        description: 'Beach access roads flooded',
        timestamp: new Date(Date.now() - 7200000),
        verified: true,
        trustScore: 0.8,
        reporter: 'Local Authority'
    },
    {
        id: 4,
        type: 'flooding',
        severity: 4,
        location: [22.5726, 88.3639], // Kolkata
        address: 'Hooghly Riverfront, Kolkata',
        description: 'High tide causing minor flooding near shore.',
        timestamp: new Date(Date.now() - 5000000),
        verified: false,
        trustScore: 0.6,
        reporter: 'Community Member'
    },
    {
        id: 5,
        type: 'pollution',
        severity: 2,
        location: [11.6643, 92.7351], // Andaman Islands
        address: 'Port Blair, Andaman Islands',
        description: 'Oil slick spotted near the harbor. Small scale, being contained.',
        timestamp: new Date(Date.now() - 86400000),
        verified: true,
        trustScore: 0.95,
        reporter: 'Port Authority'
    }
];

// ===================
// GOOGLE TRANSLATE API
// ===================
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: true
    }, 'google_translate_element');
}

/**
 * Utility function to force Google Translate to re-scan for new content.
 * This is crucial for dynamically loaded elements like map popups.
 */
function translateMapContent() {
    if (typeof google === 'object' && google.translate && google.translate.TranslateElement) {
        // Remove and re-add the element to force a refresh of the translation script's content scan.
        const translateElement = document.getElementById('google_translate_element');
        const parent = translateElement.parentElement;
        
        // Clear the content of the container
        translateElement.innerHTML = '';
        
        // Re-initialize the widget. This forces a re-scan of the DOM.
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: true
        }, 'google_translate_element');
    }
}


// ===================
// INITIALIZATION
// ===================
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeCharts();
    startRealTimeUpdates();
    detectUserLocation(); // This now uses IP-API
    loadMockData();
    setupEventListeners();
});

function setupEventListeners() {
    // Form submissions
    document.getElementById('signinForm').addEventListener('submit', handleSignin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('otpForm').addEventListener('submit', handleOTPVerification);
    document.getElementById('reportForm').addEventListener('submit', handleReportSubmission);

    // Close modals on outside click
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
            document.body.style.overflow = '';
            // Force translate refresh after modal closes in case the translation was broken
            translateMapContent();
        }
    });

    // Keyboard accessibility for modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Fix: Force translate refresh when any map popup opens
    if (map) {
        map.on('popupopen', translateMapContent);
    }
}

function loadMockData() {
    reports = [...mockReports];
    updateMapMarkers();
    updateStatistics();
    updateSocialFeed();
    updateDashboardCharts();
}

// ===================
// MAP FUNCTIONALITY
// ===================
function initializeMap() {
    // Initialize map centered on India
    map = L.map('map').setView([20.5937, 78.9629], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add click event for location selection
    map.on('click', function(e) {
        if (document.getElementById('reportModal').classList.contains('show')) {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            document.getElementById('location').value = `(${lat}, ${lng})`;

            // Simulate reverse geocoding to get a readable address
            reverseGeocodeLookup(lat, lng);
        }
    });
    
    // Fix: Add map popup event listener for translation
    map.on('popupopen', translateMapContent);
}

function updateMapMarkers() {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add new markers
    reports.forEach(report => {
        const marker = createMarker(report);
        markers.push(marker);
        marker.addTo(map);
    });
}

function createMarker(report) {
    const color = getSeverityColor(report.severity);
    const icon = getReportIcon(report.type);

    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><i class="${icon}" style="font-size: 14px;"></i></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const marker = L.marker(report.location, { icon: customIcon });

    const popupContent = createPopupContent(report);
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    });

    return marker;
}

function createPopupContent(report) {
    const timeAgo = getTimeAgo(report.timestamp);
    const verifiedBadge = report.verified ? '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">✓ Verified</span>' : '<span style="background: #ffc107; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">Pending</span>';

    return `
        <div style="padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="text-transform: capitalize; color: #008080;">${report.type.replace('_', ' ')}</strong>
                ${verifiedBadge}
            </div>
            <div style="color: #666; font-size: 0.8rem; margin-bottom: 0.5rem;">
                📍 ${report.address}<br>
                🕒 ${timeAgo}<br>
                👤 ${report.reporter}
            </div>
            <div style="margin-bottom: 1rem;">
                ${escapeHtml(report.description)}
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="voteReport(${report.id}, 'up')" style="background: #28a745; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">👍 Confirm</button>
                <button onclick="voteReport(${report.id}, 'down')" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">👎 Dispute</button>
                <button onclick="shareReport(${report.id})" style="background: #17a2b8; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">📤 Share</button>
            </div>
        </div>
    `;
}

function getSeverityColor(severity) {
    const colors = {
        1: '#28a745', // Green
        2: '#20c997', // Teal
        3: '#ffc107', // Yellow
        4: '#fd7e14', // Orange
        5: '#dc3545'  // Red
    };
    return colors[severity] || '#6c757d';
}

function getReportIcon(type) {
    const icons = {
        'tsunami': 'fas fa-water',
        'cyclone': 'fas fa-wind',
        'flooding': 'fas fa-tint',
        'erosion': 'fas fa-mountain',
        'pollution': 'fas fa-skull-crossbones',
        'debris': 'fas fa-trash',
        'wildlife': 'fas fa-fish',
        'other': 'fas fa-exclamation'
    };
    return icons[type] || 'fas fa-exclamation';
}

// ===================
// AUTHENTICATION
// ===================
function openAuthModal() {
    showModal('authModal');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    document.getElementById(tab + 'Tab').classList.add('active');
    document.getElementById(tab + 'Form').classList.add('active');
}

function handleSignin(e) {
    e.preventDefault();
    const phone = document.getElementById('signinPhone').value;

    if (!validatePhone(phone)) {
        showNotification('Please enter a valid phone number', 'danger');
        return;
    }

    // Simulate OTP sending
    setButtonLoading('signinSubmit', true);

    setTimeout(() => {
        setButtonLoading('signinSubmit', false);
        showOTPForm();
        showNotification('OTP sent to ' + phone, 'success');
        startOTPTimer();
    }, 2000);
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const phone = document.getElementById('registerPhone').value;
    const email = document.getElementById('registerEmail').value;

    if (!name.trim()) {
        showNotification('Please enter your full name', 'danger');
        return;
    }

    if (!validatePhone(phone)) {
        showNotification('Please enter a valid phone number', 'danger');
        return;
    }

    if (email && !validateEmail(email)) {
        showNotification('Please enter a valid email address', 'danger');
        return;
    }

    // Simulate registration and OTP sending
    setButtonLoading('registerSubmit', true);

    setTimeout(() => {
        setButtonLoading('registerSubmit', false);
        showOTPForm();
        showNotification('Registration successful! OTP sent to ' + phone, 'success');
        startOTPTimer();
    }, 2000);
}

function showOTPForm() {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById('otpForm').classList.add('active');
}

function handleOTPVerification(e) {
    e.preventDefault();
    const otp = Array.from(document.querySelectorAll('.otp-digit')).map(input => input.value).join('');

    if (otp.length !== 6) {
        showNotification('Please enter complete 6-digit OTP', 'danger');
        return;
    }

    setButtonLoading('otpSubmit', true);

    // Simulate OTP verification
    setTimeout(() => {
        setButtonLoading('otpSubmit', false);

        // Mock successful verification
        if (otp === '123456' || Math.random() > 0.3) {
            currentUser = {
                id: Date.now(),
                name: document.getElementById('registerName').value || 'User',
                phone: document.getElementById('signinPhone').value || document.getElementById('registerPhone').value,
                verified: true,
                trustScore: 0.8
            };

            updateAuthUI();
            closeModal('authModal');
            showNotification('Successfully signed in!', 'success');
            clearOTPTimer();
        } else {
            showNotification('Invalid OTP. Please try again.', 'danger');
        }
    }, 1500);
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    if (currentUser) {
        authBtn.innerHTML = `<i class="fas fa-user-check"></i> ${currentUser.name}`;
        authBtn.onclick = logout;
        document.querySelector('.user-location').style.display = 'flex';
    } else {
        authBtn.innerHTML = `<i class="fas fa-user"></i> Sign In`;
        authBtn.onclick = openAuthModal;
        document.querySelector('.user-location').style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    updateAuthUI();
    showNotification('Signed out successfully', 'info');
}

function startOTPTimer() {
    otpCountdown = 60;
    const resendBtn = document.getElementById('resendOTP');
    resendBtn.disabled = true;

    otpTimer = setInterval(() => {
        otpCountdown--;
        resendBtn.textContent = `Resend OTP (${otpCountdown}s)`;

        if (otpCountdown <= 0) {
            clearOTPTimer();
        }
    }, 1000);
}

function clearOTPTimer() {
    if (otpTimer) {
        clearInterval(otpTimer);
        otpTimer = null;
    }
    const resendBtn = document.getElementById('resendOTP');
    resendBtn.disabled = false;
    resendBtn.innerHTML = '<i class="fas fa-redo"></i> Resend OTP';
}

function moveToNext(current, index) {
    if (current.value.length === 1 && index < 5) {
        document.querySelectorAll('.otp-digit')[index + 1].focus();
    }
}

// ===================
// REPORT FUNCTIONALITY
// ===================
function openReportModal() {
    showModal('reportModal');
}

function handleReportSubmission(e) {
    e.preventDefault();

    const formData = {
        type: document.getElementById('incidentType').value,
        severity: parseInt(document.getElementById('severity').value),
        location: document.getElementById('location').value,
        description: document.getElementById('description').value,
        shareWithAuthorities: document.getElementById('shareWithAuthorities').checked,
        allowPublicView: document.getElementById('allowPublicView').checked
    };

    if (!formData.type || !formData.location || !formData.description) {
        showNotification('Please fill all required fields', 'danger');
        return;
    }

    setButtonLoading('submitReport', true);

    // Simulate report submission
    setTimeout(() => {
        setButtonLoading('submitReport', false);

        // Create new report
        const newReport = {
            id: Date.now(),
            ...formData,
            location: parseLocation(formData.location),
            address: formData.location,
            timestamp: new Date(),
            verified: false,
            trustScore: currentUser ? currentUser.trustScore : 0.5, // Default trust for anonymous
            reporter: currentUser ? currentUser.name : 'Anonymous'
        };

        reports.unshift(newReport);
        updateMapMarkers();
        updateStatistics();
        updateDashboardCharts();

        closeModal('reportModal');
        document.getElementById('reportForm').reset();
        updateSeverityLabel();

        showNotification('Report submitted successfully!', 'success');

        // Simulate authority notification
        if (formData.shareWithAuthorities && formData.severity >= 4) {
            setTimeout(() => {
                showNotification('High severity alert sent to INCOIS and Coast Guard', 'warning');
            }, 3000);
        }
    }, 2000);
}

function updateSeverityLabel() {
    const severity = document.getElementById('severity').value;
    const labels = ['', 'Low', 'Medium-Low', 'Medium', 'High', 'Critical'];
    document.getElementById('severityLabel').textContent = labels[severity] || 'Medium';
}

// --- UPDATED: Uses ip-api.com to get approximate current location ---
function detectUserLocation() {
    const userLocationElem = document.getElementById('userLocation');
    
    // Fetch data from ip-api.com (No API Key needed)
    fetch('http://ip-api.com/json/')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const cityName = data.city;
                const regionName = data.regionName;
                const lat = data.lat.toFixed(4);
                const lon = data.lon.toFixed(4);

                // Display nearest town/city
                userLocationElem.querySelector('span').textContent = `${cityName}, ${regionName}`;
                
                // Set coordinates for hover display
                userLocationElem.title = `Lat: ${lat}, Lng: ${lon}`;
                
                // Only display if location is available
                userLocationElem.style.display = 'flex';
                
                // If the report modal is open, update the location field (simulating default report location)
                if (document.getElementById('reportModal').classList.contains('show')) {
                    document.getElementById('location').value = `${cityName} (${lat}, ${lon})`;
                }
            } else {
                userLocationElem.querySelector('span').textContent = 'Location unavailable';
            }
        })
        .catch(error => {
            console.error('Error fetching IP location:', error);
            userLocationElem.querySelector('span').textContent = 'Location failed';
        });
}

// --- NEW/MODIFIED: Simulates location lookup for manual/map click entry ---
function reverseGeocodeLookup(lat, lng) {
    // This function can remain a simulation or be replaced by a reverse geocoding API if needed.
    const locations = [
        'Marine Drive, Mumbai',
        'Marina Beach, Chennai',
        'Calangute Beach, Goa',
        'Kovalam Beach, Kerala',
        'Puri Beach, Odisha'
    ];
    // Simulate lookup based on proximity or just pick a random one
    const location = locations[Math.floor(Math.random() * locations.length)];
    
    // Update the location input field with the coordinates and a simulated address.
    document.getElementById('location').value = `${location} (${lat}, ${lng})`;
}

// getCurrentLocation uses browser geolocation, but we can't fully rely on it being enabled/accurate.
// If the user presses the 'Use Current Location' button, we still rely on browser API for most accurate data.
function getCurrentLocation() {
    if (navigator.geolocation) {
        setButtonLoading('getCurrentLocation', true);
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                
                // Use reverse geocode to get a readable address and update input
                reverseGeocodeLookup(lat, lng); 
                
                setButtonLoading('getCurrentLocation', false);
            },
            function(error) {
                setButtonLoading('getCurrentLocation', false);
                showNotification('Unable to get precise location. Using IP-based location.', 'warning');
                
                // Fallback to IP-API data already loaded in the header if geolocation fails
                const locText = document.getElementById('userLocation').querySelector('span').textContent;
                const coords = document.getElementById('userLocation').title.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/);
                if (coords) {
                    document.getElementById('location').value = `${locText} (${coords[1]}, ${coords[2]})`;
                }
            }
        );
    } else {
        showNotification('Geolocation not supported by browser', 'danger');
    }
}

function handleFileUpload(input) {
    const files = Array.from(input.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const uploadedContainer = document.getElementById('uploadedFiles');

    files.forEach((file, index) => {
        if (file.size > maxSize) {
            showNotification(`File ${file.name} is too large. Max size: 10MB`, 'danger');
            return;
        }

        // Simulate file upload with progress
        const progressBar = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');

        progressBar.style.display = 'block';

        let progress = 0;
        const uploadInterval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
                progress = 100;
                clearInterval(uploadInterval);

                setTimeout(() => {
                    progressBar.style.display = 'none';
                    addUploadedFile(file);
                }, 500);
            }
            progressFill.style.width = progress + '%';
        }, 200);
    });
}

function addUploadedFile(file) {
    const container = document.getElementById('uploadedFiles');
    const fileElement = document.createElement('div');
    fileElement.className = 'uploaded-file';
    fileElement.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem;
        background: var(--light-gray);
        border-radius: var(--border-radius);
        margin-top: 0.5rem;
    `;

    fileElement.innerHTML = `
        <span><i class="fas fa-file"></i> ${file.name} (${formatFileSize(file.size)})</span>
        <button type="button" onclick="removeUploadedFile(this)" style="background: none; border: none; color: var(--danger-red); cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(fileElement);
}

function removeUploadedFile(button) {
    button.parentElement.remove();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===================
// FILTERING & SEARCH
// ===================
function filterReports(filter) {
    // Update active filter chip
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    let filteredReports = [...reports];

    switch(filter) {
        case 'all':
            break;
        case 'tsunami':
        case 'cyclone':
        case 'flooding':
            filteredReports = reports.filter(r => r.type === filter);
            break;
        case 'verified':
            filteredReports = reports.filter(r => r.verified);
            break;
        case 'recent':
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            filteredReports = reports.filter(r => r.timestamp > oneDayAgo);
            break;
    }

    // Update map with filtered markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    filteredReports.forEach(report => {
        const marker = createMarker(report);
        markers.push(marker);
        marker.addTo(map);
    });

    showNotification(`Showing ${filteredReports.length} reports`, 'info');
}

function toggleLayer(layer) {
    // This would control different data layers on the map
    showNotification(`${layer} layer toggled`, 'info');
}

// ===================
// DASHBOARD & CHARTS
// ===================
function initializeCharts() {
    const colors = {
        primary: '#667eea',
        secondary: '#764ba2',
        teal: '#008080',
        deep: '#006666',
        red: '#dc3545',
        orange: '#ff6b35',
        green: '#28a745',
        yellow: '#ffc107',
        blue: '#17a2b8'
    };
    
    // Timeline Chart
    const timeCtx = document.getElementById('timelineChart').getContext('2d');
    dashboardCharts.timeline = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'],
            datasets: [{
                label: 'Reports',
                data: [12, 19, 3, 5, 12, 8, 15],
                borderColor: colors.teal,
                backgroundColor: 'rgba(0, 128, 128, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Incident Types Chart
    const incidentCtx = document.getElementById('incidentChart').getContext('2d');
    dashboardCharts.incident = new Chart(incidentCtx, {
        type: 'doughnut',
        data: {
            labels: ['Tsunami', 'Cyclone', 'Flooding', 'Pollution', 'Other'],
            datasets: [{
                data: [23, 45, 67, 34, 28],
                backgroundColor: [colors.red, colors.orange, colors.yellow, colors.green, colors.blue]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Verification Chart
    const verificationCtx = document.getElementById('verificationChart').getContext('2d');
    dashboardCharts.verification = new Chart(verificationCtx, {
        type: 'bar',
        data: {
            labels: ['Verified', 'Pending', 'Disputed'],
            datasets: [{
                data: [89, 38, 12],
                backgroundColor: [colors.green, colors.yellow, colors.red]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Regional Chart
    const regionalCtx = document.getElementById('regionalChart').getContext('2d');
    dashboardCharts.regional = new Chart(regionalCtx, {
        type: 'polarArea',
        data: {
            labels: ['West Coast', 'East Coast', 'Southern Coast', 'Island Territories'],
            datasets: [{
                data: [65, 78, 45, 23],
                backgroundColor: [colors.primary, colors.secondary, colors.teal, colors.deep]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // New Chart: Trust Score Distribution
    const trustCtx = document.getElementById('trustScoreChart').getContext('2d');
    dashboardCharts.trustScore = new Chart(trustCtx, {
        type: 'line',
        data: {
            labels: ['0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'],
            datasets: [{
                label: 'Number of Reports',
                data: [5, 12, 35, 28, 20],
                borderColor: colors.primary,
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateDashboardCharts() {
    // This function would fetch real data and update charts.
    // For now, it updates the charts with mock data based on the current `reports` array.
    const incidentCounts = reports.reduce((acc, report) => {
        acc[report.type] = (acc[report.type] || 0) + 1;
        return acc;
    }, {});
    dashboardCharts.incident.data.datasets[0].data = [
        incidentCounts['tsunami'] || 0,
        incidentCounts['cyclone'] || 0,
        incidentCounts['flooding'] || 0,
        incidentCounts['pollution'] || 0,
        incidentCounts['other'] || 0
    ];
    dashboardCharts.incident.update();
}

// ===================
// VIEW MANAGEMENT
// ===================
function switchView(view) {
    currentView = view;

    // Hide all views
    document.getElementById('mapView').style.display = 'none';
    document.getElementById('dashboardView').classList.remove('active');

    // Show selected view
    if (view === 'map') {
        document.getElementById('mapView').style.display = 'block';
        setTimeout(() => map.invalidateSize(), 100);
        
        // FIX: Force Google Translate to re-scan content on map view activation
        translateMapContent();
    } else if (view === 'dashboard') {
        document.getElementById('dashboardView').classList.add('active');
    }
}

// ===================
// UTILITY FUNCTIONS
// ===================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus first input
    const firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div>
            <strong>${getNotificationIcon(type)}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    document.getElementById('notifications').appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        'success': '✓',
        'danger': '⚠',
        'warning': '⚡',
        'info': 'ℹ'
    };
    return icons[type] || 'ℹ';
}

function setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function validatePhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function parseLocation(locationString) {
    const coords = locationString.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
    if (coords) {
        return [parseFloat(coords[1]), parseFloat(coords[2])];
    }
    // Default to Mumbai if parsing fails
    return [19.0760, 72.8777];
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function updateStatistics() {
    document.getElementById('activeReports').textContent = reports.length;
    document.getElementById('verifiedIncidents').textContent = reports.filter(r => r.verified).length;
    document.getElementById('activeUsers').textContent = Math.floor(Math.random() * 1000) + 2000;
    document.getElementById('alertsIssued').textContent = Math.floor(Math.random() * 20) + 10;
    
    // Update new statistics
    const mostReported = reports.reduce((acc, report) => {
        acc[report.type] = (acc[report.type] || 0) + 1;
        return acc;
    }, {});
    const mostReportedType = Object.keys(mostReported).sort((a,b) => mostReported[b] - mostReported[a])[0];
    document.getElementById('mostReportedType').textContent = mostReportedType.replace('_', ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    
    document.getElementById('avgVerificationTime').textContent = `${(Math.random() * 2 + 1).toFixed(1)} hours`;
    document.getElementById('userEngagement').textContent = `${(Math.random() * 2 + 8).toFixed(1)} / 10`;
}

function updateSocialFeed() {
    // This would typically fetch real social media data
    const feedContainer = document.getElementById('socialFeed');

    // Mock social media posts
    const mockPosts = [
        {
            platform: 'twitter',
            user: '@weatheralert_in',
            content: 'Heavy rainfall reported in coastal Karnataka. Citizens advised to stay indoors and avoid low-lying areas.',
            sentiment: 'negative',
            timestamp: new Date(Date.now() - 120000)
        },
        {
            platform: 'facebook',
            user: 'Indian Coast Guard',
            content: 'Routine patrol operations continue along the western coast. All vessels are advised to monitor weather conditions.',
            sentiment: 'neutral',
            timestamp: new Date(Date.now() - 900000)
        }
    ];

    // Update feed periodically
    socialPosts = mockPosts;
}

function startRealTimeUpdates() {
    setInterval(() => {
        // Simulate real-time updates
        if (Math.random() > 0.7) {
            // Add new mock report occasionally
            const types = ['tsunami', 'cyclone', 'flooding', 'pollution', 'erosion', 'debris', 'wildlife', 'other'];
            const locations = [
                [19.0760, 72.8777, 'Mumbai'],
                [13.0827, 80.2707, 'Chennai'],
                [15.2993, 74.1240, 'Goa'],
                [22.5726, 88.3639, 'Kolkata'],
                [11.6643, 92.7351, 'Andaman Islands']
            ];

            const randomType = types[Math.floor(Math.random() * types.length)];
            const randomLocation = locations[Math.floor(Math.random() * locations.length)];

            const newReport = {
                id: Date.now(),
                type: randomType,
                severity: Math.floor(Math.random() * 5) + 1,
                location: [randomLocation[0], randomLocation[1]],
                address: randomLocation[2],
                description: 'Auto-generated report from monitoring systems',
                timestamp: new Date(),
                verified: Math.random() > 0.5,
                trustScore: Math.random(),
                reporter: 'System Monitor'
            };

            reports.unshift(newReport);
            if (reports.length > 50) reports.pop(); // Keep only recent reports

            updateMapMarkers();
            updateStatistics();
            updateDashboardCharts();
        }
    }, 30000); // Update every 30 seconds
}

// ===================
// REPORT ACTIONS
// ===================
function voteReport(reportId, voteType) {
    if (!currentUser) {
        showNotification('Please sign in to vote on reports', 'warning');
        return;
    }

    const report = reports.find(r => r.id === reportId);
    if (report) {
        const action = voteType === 'up' ? 'confirmed' : 'disputed';
        showNotification(`Report ${action} successfully`, 'success');

        // Update trust score based on vote
        if (voteType === 'up') {
            report.trustScore = Math.min(1, report.trustScore + 0.1);
        } else {
            report.trustScore = Math.max(0, report.trustScore - 0.1);
        }
    }
}

function shareReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        if (navigator.share) {
            navigator.share({
                title: `Ocean Guardian Alert: ${report.type}`,
                text: report.description,
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            const shareText = `Ocean Guardian Alert: ${report.type}\n${report.description}\n${window.location.href}`;
            navigator.clipboard.writeText(shareText).then(() => {
                showNotification('Report link copied to clipboard', 'success');
            });
        }
    }
}

function showAlerts() {
    const criticalReports = reports.filter(r => r.severity >= 4);
    const alertsContainer = document.getElementById('alerts-container');
    alertsContainer.innerHTML = '';

    if (criticalReports.length === 0) {
        alertsContainer.innerHTML = '<p>No critical alerts at this time.</p>';
        showNotification('No critical alerts at this time', 'info');
    } else {
        criticalReports.forEach(report => {
            const alertElement = document.createElement('div');
            alertElement.className = `social-post sentiment-${report.severity >= 5 ? 'negative' : 'neutral'}`;
            alertElement.innerHTML = `
                <div class="post-meta">
                    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                    <span>${report.reporter}</span>
                    <span>•</span>
                    <span>${getTimeAgo(report.timestamp)}</span>
                </div>
                <div class="post-content">
                    <strong>${report.type.toUpperCase()}:</strong> ${escapeHtml(report.description)}
                    <br>
                    <small>Location: ${report.address}</small>
                </div>
            `;
            alertsContainer.appendChild(alertElement);
        });
        showNotification(`${criticalReports.length} critical alerts active`, 'warning');
    }
    showModal('alertsModal');
}

function toggleMobileMenu() {
    document.getElementById('sidebar').classList.toggle('active');
}

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'r':
                e.preventDefault();
                openReportModal();
                break;
            case 'm':
                e.preventDefault();
                switchView('map');
                break;
            case 'd':
                e.preventDefault();
                switchView('dashboard');
                break;
        }
    }
});

// PWA Service Worker Registration (placeholder)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // navigator.serviceWorker.register('/sw.js')
        //   .then(registration => console.log('SW registered'))
        //   .catch(error => console.log('SW registration failed'));
    });
}