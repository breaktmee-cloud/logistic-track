// Variables globales
let currentLocation = null;
let mapMobile = null;
let mapDesktop = null;
let markerMobile = null;
let markerDesktop = null;

// Configuración para Google Sheets
const SHEET_CONFIG = {
    // ✅ REEMPLAZA ESTO con tu URL REAL de Google Apps Script
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz4N2X3IdbCoh3DsF5qhOgbATNHGD8GpiFNjGkO_Bo8Q5wdciZ0KR7-B4jaWPkRk07m/exec'
};

// Elementos del DOM
const packageCodeInput = document.getElementById('packageCode');
const phoneInput = document.getElementById('phone');
const pickupCheckbox = document.getElementById('pickupCheckbox');
const getLocationBtn = document.getElementById('getLocationBtn');
const submitBtn = document.getElementById('submitBtn');
const locationStatus = document.getElementById('locationStatus');
const locationForm = document.getElementById('locationForm');
const successMessage = document.getElementById('successMessage');
const loading = document.getElementById('loading');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const successDetails = document.getElementById('successDetails');
const mapContainerMobile = document.getElementById('mapContainerMobile');
const mapContainerDesktop = document.getElementById('mapContainerDesktop');
const mapCoordsMobile = document.getElementById('mapCoordsMobile');
const mapCoordsDesktop = document.getElementById('mapCoordsDesktop');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Página cargada - Inicializando...');
    
    // Verificar si Leaflet está cargado
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet no está cargado');
        showError('Error: Mapas no disponibles. Recarga la página.');
        return;
    }
    
    // Eventos del formulario
    getLocationBtn.addEventListener('click', getCurrentLocation);
    locationForm.addEventListener('submit', handleSubmit);
    
    // Validación en tiempo real
    packageCodeInput.addEventListener('input', validateForm);
    phoneInput.addEventListener('input', validateForm);
    
    // Auto-formato del teléfono
    phoneInput.addEventListener('input', formatPhone);
    
    // Checkbox de recojo en punto
    pickupCheckbox.addEventListener('change', handlePickupChange);
    
    // Cerrar modal de error
    errorModal.addEventListener('click', function(e) {
        if (e.target === errorModal) {
            closeError();
        }
    });
    
    console.log('✅ Event listeners configurados');
});

// Manejar cambio del checkbox de recojo
function handlePickupChange() {
    const isPickup = pickupCheckbox.checked;
    const locationSection = document.querySelector('.location-section');
    
    console.log('🔄 Checkbox cambiado:', isPickup);
    
    if (isPickup) {
        locationSection.style.display = 'none';
        mapContainerMobile.classList.add('hidden');
        mapContainerDesktop.classList.add('hidden');
        currentLocation = { latitude: 0, longitude: 0, isPickup: true };
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar recojo en punto';
    } else {
        locationSection.style.display = 'block';
        currentLocation = null;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Registrar ubicación';
    }
    
    validateForm();
}

// Obtener ubicación actual - VERSIÓN MEJORADA
function getCurrentLocation() {
    console.log('📍 Solicitando ubicación...');
    
    if (!navigator.geolocation) {
        showError('Tu navegador no soporta geolocalización');
        return;
    }

    showLoading();
    getLocationBtn.disabled = true;
    getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';

    const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 segundos
        maximumAge: 60000
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('✅ Ubicación obtenida:', position.coords);
            hideLoading();
            
            const { latitude, longitude } = position.coords;
            currentLocation = { latitude, longitude };
            
            showLocationSuccess(latitude, longitude);
            showMaps(latitude, longitude);
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar ubicación';
            validateForm();
        },
        (error) => {
            console.error('❌ Error obteniendo ubicación:', error);
            hideLoading();
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Obtener mi ubicación';
            
            let errorMsg = 'No se pudo obtener tu ubicación. ';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg += 'Por favor permite el acceso a tu ubicación en la configuración de tu navegador.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg += 'Ubicación no disponible. Verifica tu conexión.';
                    break;
                case error.TIMEOUT:
                    errorMsg += 'Tiempo de espera agotado. Intenta nuevamente.';
                    break;
                default:
                    errorMsg += 'Error desconocido.';
                    break;
            }
            showError(errorMsg);
        },
        options
    );
}

// Mostrar ubicación exitosa
function showLocationSuccess(lat, lng) {
    locationStatus.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Ubicación obtenida: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
    `;
    locationStatus.classList.add('success');
}

// Manejar envío del formulario
async function handleSubmit(e) {
    e.preventDefault();
    console.log('📤 Enviando formulario...');
    
    if (!validateForm()) {
        showError('Por favor completa todos los campos correctamente.');
        return;
    }

    const packageCode = packageCodeInput.value.trim();
    const phone = phoneInput.value.trim();
    
    console.log('📝 Datos a guardar:', { packageCode, phone, currentLocation });
    
    showLoading();
    
    try {
        // Guardar registro
        const result = await saveToGoogleSheets(packageCode, phone, currentLocation);
        console.log('✅ Resultado del guardado:', result);
        
        hideLoading();
        showSuccessMessage(packageCode, phone, currentLocation);
        
    } catch (error) {
        console.error('❌ Error en envío:', error);
        hideLoading();
        showError('Error al guardar el registro: ' + error.message);
    }
}

// Guardar en Google Sheets
async function saveToGoogleSheets(packageCode, phone, location) {
    console.log('💾 Intentando guardar en Google Sheets...');
    
    // Si es recojo en punto, usar coordenadas especiales
    const finalLocation = location.isPickup ? 
        { latitude: -12.048012, longitude: -77.000123, isPickup: true } : 
        location;
    
    try {
        // Verificar si tenemos URL válida
        if (!SHEET_CONFIG.SCRIPT_URL || SHEET_CONFIG.SCRIPT_URL.includes('TU_SCRIPT_ID')) {
            throw new Error('URL de Google Sheets no configurada');
        }
        
        const response = await fetch(SHEET_CONFIG.SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                packageCode: packageCode,
                phone: phone,
                latitude: finalLocation.latitude,
                longitude: finalLocation.longitude,
                isPickup: finalLocation.isPickup || false,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 Respuesta de Google Sheets:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Error desconocido en Google Sheets');
        }
        
        return result;
        
    } catch (error) {
        console.warn('⚠️ Fallback a localStorage:', error.message);
        // Si falla, guardar en localStorage
        return saveToLocalStorage(packageCode, phone, finalLocation);
    }
}

// Guardar en localStorage como fallback
function saveToLocalStorage(packageCode, phone, location) {
    try {
        const registration = {
            id: Date.now(),
            packageCode,
            phone,
            latitude: location.latitude,
            longitude: location.longitude,
            isPickup: location.isPickup || false,
            timestamp: new Date().toISOString()
        };
        
        const existing = JSON.parse(localStorage.getItem('locationRegistrations') || '[]');
        existing.unshift(registration);
        localStorage.setItem('locationRegistrations', JSON.stringify(existing));
        
        console.log('💾 Guardado en localStorage:', registration);
        return { success: true, source: 'localStorage', ...registration };
    } catch (error) {
        console.error('❌ Error guardando en localStorage:', error);
        return { success: false, error: error.message };
    }
}

// Validar formulario
function validateForm() {
    const packageCode = packageCodeInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, '');
    const isPickup = pickupCheckbox.checked;
    const hasLocation = currentLocation !== null;
    
    const isValidPackageCode = /^6\d{12}$/.test(packageCode);
    const isValidPhone = /^\d{9}$/.test(phone);
    
    // Actualizar clases visuales
    packageCodeInput.classList.toggle('valid', isValidPackageCode && packageCode.length > 0);
    packageCodeInput.classList.toggle('invalid', !isValidPackageCode && packageCode.length > 0);
    
    phoneInput.classList.toggle('valid', isValidPhone && phone.length > 0);
    phoneInput.classList.toggle('invalid', !isValidPhone && phone.length > 0);
    
    const isValid = isValidPackageCode && isValidPhone && (isPickup || hasLocation);
    submitBtn.disabled = !isValid;
    
    console.log('🔍 Validación:', { isValidPackageCode, isValidPhone, isPickup, hasLocation, isValid });
    
    return isValid;
}

// Formatear teléfono
function formatPhone(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 9) {
        value = value.substring(0, 9);
    }
    
    if (value.length > 0) {
        const match = value.match(/(\d{0,3})(\d{0,3})(\d{0,3})/);
        if (match) {
            let formatted = match[1];
            if (match[2]) formatted += ' ' + match[2];
            if (match[3]) formatted += ' ' + match[3];
            value = formatted;
        }
    }
    
    e.target.value = value.trim();
}

// Mostrar mensaje de éxito
function showSuccessMessage(packageCode, phone, location) {
    const timestamp = new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const isPickup = location.isPickup === true;
    
    if (isPickup) {
        successDetails.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h4 style="color: #27ae60; margin-bottom: 8px;">
                    <i class="fas fa-store"></i> Recojo en San Juan de Lurigancho
                </h4>
                <p style="color: #155724;">
                    ✅ <strong>Un asesor se contactará con usted para coordinar el recojo</strong>
                </p>
            </div>
            <div><strong>Código:</strong> ${packageCode}</div>
            <div><strong>Teléfono:</strong> ${phone}</div>
            <div><strong>Fecha de solicitud:</strong> ${timestamp}</div>
        `;
    } else {
        successDetails.innerHTML = `
            <div><strong>Código:</strong> ${packageCode}</div>
            <div><strong>Teléfono:</strong> ${phone}</div>
            <div><strong>Ubicación:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>
            <div><strong>Fecha:</strong> ${timestamp}</div>
        `;
    }

    mapContainerMobile.classList.add('hidden');
    mapContainerDesktop.classList.add('hidden');
    locationForm.parentElement.classList.add('hidden');
    successMessage.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Resetear formulario
function resetForm() {
    packageCodeInput.value = '';
    phoneInput.value = '';
    pickupCheckbox.checked = false;
    currentLocation = null;
    
    const locationSection = document.querySelector('.location-section');
    locationSection.style.display = 'block';
    
    locationStatus.innerHTML = `
        <i class="fas fa-crosshairs"></i>
        <span>Presiona el botón para obtener tu ubicación</span>
    `;
    locationStatus.classList.remove('success');
    
    getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Obtener mi ubicación';
    getLocationBtn.disabled = false;
    
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Registrar ubicación';
    submitBtn.disabled = true;
    
    mapContainerMobile.classList.add('hidden');
    mapContainerDesktop.classList.add('hidden');
    
    packageCodeInput.classList.remove('valid', 'invalid');
    phoneInput.classList.remove('valid', 'invalid');
    
    locationForm.parentElement.classList.remove('hidden');
    successMessage.classList.add('hidden');
    
    packageCodeInput.focus();
}

// Funciones del mapa - VERSIÓN CORREGIDA
function showMaps(lat, lng) {
    console.log('🗺 Mostrando mapas:', lat, lng);
    
    mapContainerMobile.classList.remove('hidden');
    mapContainerDesktop.classList.remove('hidden');
    
    initMobileMap(lat, lng);
    initDesktopMap(lat, lng);
    updateMapCoords(lat, lng);
}

function initMobileMap(lat, lng) {
    try {
        if (!mapMobile) {
            console.log('📱 Inicializando mapa móvil...');
            mapMobile = L.map('mapMobile').setView([lat, lng], 16);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(mapMobile);
            
            markerMobile = L.marker([lat, lng], {
                draggable: true,
                title: 'Arrastra para ajustar tu ubicación'
            }).addTo(mapMobile);
            
            markerMobile.bindPopup('<b>Tu ubicación</b><br>Arrastra el marcador para ajustar').openPopup();
            
            markerMobile.on('dragend', function(e) {
                const position = e.target.getLatLng();
                updateLocation(position.lat, position.lng);
            });
            
            mapMobile.on('click', function(e) {
                const { lat, lng } = e.latlng;
                markerMobile.setLatLng([lat, lng]);
                updateLocation(lat, lng);
            });
            
            console.log('✅ Mapa móvil inicializado');
        } else {
            mapMobile.setView([lat, lng], 16);
            markerMobile.setLatLng([lat, lng]);
        }
        
        setTimeout(() => {
            if (mapMobile) mapMobile.invalidateSize();
        }, 100);
    } catch (error) {
        console.error('❌ Error inicializando mapa móvil:', error);
    }
}

function initDesktopMap(lat, lng) {
    try {
        if (!mapDesktop) {
            console.log('💻 Inicializando mapa desktop...');
            mapDesktop = L.map('mapDesktop').setView([lat, lng], 16);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(mapDesktop);
            
            markerDesktop = L.marker([lat, lng], {
                draggable: true,
                title: 'Arrastra para ajustar tu ubicación'
            }).addTo(mapDesktop);
            
            markerDesktop.bindPopup('<b>Tu ubicación</b><br>Arrastra el marcador para ajustar').openPopup();
            
            markerDesktop.on('dragend', function(e) {
                const position = e.target.getLatLng();
                updateLocation(position.lat, position.lng);
            });
            
            mapDesktop.on('click', function(e) {
                const { lat, lng } = e.latlng;
                markerDesktop.setLatLng([lat, lng]);
                updateLocation(lat, lng);
            });
            
            console.log('✅ Mapa desktop inicializado');
        } else {
            mapDesktop.setView([lat, lng], 16);
            markerDesktop.setLatLng([lat, lng]);
        }
        
        setTimeout(() => {
            if (mapDesktop) mapDesktop.invalidateSize();
        }, 100);
    } catch (error) {
        console.error('❌ Error inicializando mapa desktop:', error);
    }
}

function updateLocation(lat, lng) {
    try {
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('Coordenadas inválidas');
        }
        
        currentLocation = { latitude: lat, longitude: lng };
        
        if (markerMobile) markerMobile.setLatLng([lat, lng]);
        if (markerDesktop) markerDesktop.setLatLng([lat, lng]);
        
        updateMapCoords(lat, lng);
        showLocationSuccess(lat, lng);
        validateForm();
    } catch (error) {
        console.error('Error actualizando ubicación:', error);
        showError('Error al actualizar la ubicación');
    }
}

function updateMapCoords(lat, lng) {
    const coordText = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (mapCoordsMobile) mapCoordsMobile.textContent = coordText;
    if (mapCoordsDesktop) mapCoordsDesktop.textContent = coordText;
}

// Utilidades
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(message) {
    console.error('❌ Error:', message);
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
}

function closeError() {
    errorModal.classList.add('hidden');
}

// Auto-enfocar al cargar
window.addEventListener('load', function() {
    console.log('🎯 Enfocando campo de código...');
    packageCodeInput.focus();
});

// Verificar que todo esté cargado
console.log('🔧 script.js cargado correctamente');