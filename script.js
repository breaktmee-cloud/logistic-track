// ===== CONFIGURACIÓN Y CONSTANTES =====
const CONFIG = {
    // Configuración de Google Sheets (Opcional - para futuro)
    SHEETS: {
        API_URL: '', // Se configurará si se usa backend
        ENABLED: false // Cambiar a true cuando tengas backend
    },
    
    // Configuración de la aplicación
    APP: {
        MAX_RETRIES: 2,
        TIMEOUT: 15000,
        PICKUP_LOCATION: {
            lat: -12.048012,
            lng: -77.000123,
            name: "San Juan de Lurigancho"
        }
    },
    
    // Validaciones
    VALIDATION: {
        PACKAGE_CODE: /^6\d{12}$/,
        PHONE: /^\d{9}$/,
        COORDINATES: {
            LAT: { min: -90, max: 90 },
            LNG: { min: -180, max: 180 }
        }
    }
};

// ===== ESTADO GLOBAL DE LA APLICACIÓN =====
const AppState = {
    currentLocation: null,
    mapMobile: null,
    mapDesktop: null,
    markerMobile: null,
    markerDesktop: null,
    isSubmitting: false,
    retryCount: 0
};

// ===== ELEMENTOS DEL DOM =====
const DOM = {
    // Formulario
    packageCodeInput: document.getElementById('packageCode'),
    phoneInput: document.getElementById('phone'),
    pickupCheckbox: document.getElementById('pickupCheckbox'),
    getLocationBtn: document.getElementById('getLocationBtn'),
    submitBtn: document.getElementById('submitBtn'),
    locationForm: document.getElementById('locationForm'),
    locationSection: document.getElementById('locationSection'),
    
    // Estados y mensajes
    locationStatus: document.getElementById('locationStatus'),
    successMessage: document.getElementById('successMessage'),
    successDetails: document.getElementById('successDetails'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText'),
    errorModal: document.getElementById('errorModal'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    submitText: document.getElementById('submitText'),
    
    // Validación
    packageCodeValidation: document.getElementById('packageCodeValidation'),
    phoneValidation: document.getElementById('phoneValidation'),
    
    // Mapas
    mapContainerMobile: document.getElementById('mapContainerMobile'),
    mapContainerDesktop: document.getElementById('mapContainerDesktop'),
    mapCoordsMobile: document.getElementById('mapCoordsMobile'),
    mapCoordsDesktop: document.getElementById('mapCoordsDesktop')
};

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
class LogisticTrackApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkCompatibility();
        this.autoFocusFirstField();
        
        console.log('🚀 LogisticTrack App inicializada');
    }

    setupEventListeners() {
        // Eventos del formulario
        DOM.getLocationBtn.addEventListener('click', () => this.getCurrentLocation());
        DOM.locationForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Validación en tiempo real
        DOM.packageCodeInput.addEventListener('input', () => {
            this.validatePackageCode();
            this.validateForm();
        });
        
        DOM.phoneInput.addEventListener('input', () => {
            this.formatPhone();
            this.validatePhone();
            this.validateForm();
        });
        
        // Checkbox de recojo en punto
        DOM.pickupCheckbox.addEventListener('change', () => this.handlePickupChange());
        
        // Cerrar modal de error
        DOM.errorModal.addEventListener('click', (e) => {
            if (e.target === DOM.errorModal) {
                this.closeError();
            }
        });

        // Prevenir envío con Enter en campos individuales
        DOM.packageCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
        
        DOM.phoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
    }

    checkCompatibility() {
        const checks = {
            geolocation: !!navigator.geolocation,
            localStorage: !!window.localStorage,
            fetch: !!window.fetch,
            leaflet: typeof L !== 'undefined'
        };

        console.log('🔍 Compatibilidad del navegador:', checks);

        if (!checks.geolocation) {
            this.showError(
                'Tu navegador no soporta geolocalización. ' +
                'Por favor usa Chrome, Firefox o Safari actualizado.',
                'Navegador No Compatible'
            );
        }

        if (!checks.leaflet) {
            console.warn('⚠️ Leaflet no está cargado correctamente');
        }
    }

    autoFocusFirstField() {
        setTimeout(() => {
            if (DOM.packageCodeInput) {
                DOM.packageCodeInput.focus();
            }
        }, 500);
    }

    // ===== MANEJO DE OPCIÓN DE RECOJO =====
    handlePickupChange() {
        const isPickup = DOM.pickupCheckbox.checked;
        
        console.log('🔄 Opción de recojo:', isPickup ? 'ACTIVADA' : 'DESACTIVADA');

        if (isPickup) {
            this.activatePickupMode();
        } else {
            this.deactivatePickupMode();
        }
        
        this.validateForm();
    }

    activatePickupMode() {
        DOM.locationSection.style.display = 'none';
        DOM.mapContainerMobile.classList.add('hidden');
        DOM.mapContainerDesktop.classList.add('hidden');
        
        AppState.currentLocation = {
            latitude: CONFIG.APP.PICKUP_LOCATION.lat,
            longitude: CONFIG.APP.PICKUP_LOCATION.lng,
            isPickup: true
        };
        
        DOM.submitText.textContent = 'Solicitar recojo en punto';
        
        this.showLocationStatus(
            `📍 Recojo en ${CONFIG.APP.PICKUP_LOCATION.name}`,
            'info'
        );
    }

    deactivatePickupMode() {
        DOM.locationSection.style.display = 'block';
        AppState.currentLocation = null;
        DOM.submitText.textContent = 'Registrar ubicación';
        
        this.showLocationStatus(
            'Haz clic en el botón para obtener tu ubicación',
            'default'
        );
    }

    // ===== SISTEMA DE GEOLOCALIZACIÓN MEJORADO =====
    async getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showError(
                'Tu navegador no soporta geolocalización.',
                'Función No Disponible'
            );
            return;
        }

        console.log('📍 Iniciando obtención de ubicación...');
        
        // Mostrar información antes de obtener ubicación
        this.showLocationInfo();
        
        // Pequeña pausa para que el usuario lea la información
        await this.delay(2000);
        
        // Iniciar el proceso de geolocalización
        await this.startGeolocationProcess();
    }

    showLocationInfo() {
        this.showLocationStatus(
            '<strong>📍 Las coordenadas son específicamente para agilizar tu pedido</strong><br>' +
            'Estamos obteniendo tu ubicación exacta...',
            'info'
        );
        
        DOM.getLocationBtn.disabled = true;
        DOM.getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
    }

    async startGeolocationProcess() {
        try {
            AppState.retryCount = 0;
            await this.attemptGeolocation(true); // Primer intento: alta precisión
        } catch (error) {
            console.error('❌ Todos los intentos fallaron:', error);
            this.handleGeolocationError(error, true);
        }
    }

    async attemptGeolocation(highAccuracy = true) {
        AppState.retryCount++;
        
        const options = {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 10000 : 20000, // 10s o 20s
            maximumAge: 60000 // 1 minuto en caché
        };

        console.log(`🔄 Intento ${AppState.retryCount}:`, 
                   highAccuracy ? 'Alta precisión' : 'Baja precisión');

        this.showLoading(highAccuracy ? 
            'Obteniendo ubicación precisa...' : 
            'Buscando ubicación...'
        );

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.hideLoading();
                    this.handleGeolocationSuccess(position, highAccuracy);
                    resolve(position);
                },
                (error) => {
                    this.hideLoading();
                    this.handleGeolocationAttemptError(error, highAccuracy, reject);
                },
                options
            );
        });
    }

    handleGeolocationSuccess(position, highAccuracy) {
        const { latitude, longitude, accuracy } = position.coords;
        
        console.log(`✅ Ubicación obtenida (${highAccuracy ? 'alta' : 'baja'} precisión):`, {
            latitude,
            longitude,
            accuracy: `${accuracy}m`
        });

        AppState.currentLocation = { latitude, longitude };
        
        this.showLocationSuccess(latitude, longitude);
        this.showMaps(latitude, longitude);
        
        DOM.getLocationBtn.disabled = false;
        DOM.getLocationBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar ubicación';
        
        this.validateForm();
    }

    handleGeolocationAttemptError(error, highAccuracy, reject) {
        console.warn(`⚠️ Intento ${AppState.retryCount} falló:`, error.message);

        if (highAccuracy && error.code === error.TIMEOUT && AppState.retryCount < CONFIG.APP.MAX_RETRIES) {
            // Reintentar con baja precisión
            console.log('🔄 Reintentando con baja precisión...');
            setTimeout(() => {
                this.attemptGeolocation(false).then(reject).catch(reject);
            }, 1000);
        } else {
            reject(error);
        }
    }

    handleGeolocationError(error, isFinalAttempt) {
        let message, title;
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                title = 'Permiso Denegado';
                message = 'Para usar esta función, necesitamos acceso a tu ubicación.\n\n' +
                         '💡 <strong>Cómo solucionarlo:</strong>\n' +
                         '• Haz clic en el ícono de ubicación 🔒 en la barra del navegador\n' +
                         '• Selecciona "Permitir" para este sitio\n' +
                         '• Recarga la página e intenta nuevamente';
                break;
                
            case error.POSITION_UNAVAILABLE:
                title = 'Ubicación No Disponible';
                message = 'No pudimos determinar tu ubicación.\n\n' +
                         '💡 <strong>Posibles soluciones:</strong>\n' +
                         '• Verifica tu conexión a Internet\n' +
                         '• Activa el GPS en tu dispositivo\n' +
                         '• Si estás en interiores, acércate a una ventana\n' +
                         '• Espera unos segundos y reintenta';
                break;
                
            case error.TIMEOUT:
                title = 'Tiempo Agotado';
                message = 'La obtención de ubicación está tardando más de lo normal.\n\n' +
                         '💡 <strong>Recomendaciones:</strong>\n' +
                         '• Activa el GPS y espera a que se conecte\n' +
                         '• Sal a un área abierta con mejor señal\n' +
                         '• Cierra otras apps que usen GPS\n' +
                         '• Reintenta en unos momentos';
                break;
                
            default:
                title = 'Error Inesperado';
                message = 'Ocurrió un error inesperado al obtener tu ubicación.\n\n' +
                         '💡 <strong>Qué puedes hacer:</strong>\n' +
                         '• Recarga la página\n' +
                         '• Verifica tu conexión a Internet\n' +
                         '• Intenta con otro navegador\n' +
                         '• Contacta a soporte si el problema persiste';
                break;
        }

        DOM.getLocationBtn.disabled = false;
        DOM.getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Obtener mi ubicación';
        
        this.showError(message, title);
    }

    // ===== VALIDACIÓN DE FORMULARIO =====
    validateForm() {
        const packageCode = DOM.packageCodeInput.value.trim();
        const phone = DOM.phoneInput.value.replace(/\D/g, '');
        const isPickup = DOM.pickupCheckbox.checked;
        const hasLocation = AppState.currentLocation !== null;

        const isValidPackageCode = this.validatePackageCode();
        const isValidPhone = this.validatePhone();
        
        // Validar ubicación (a menos que sea recojo en punto)
        const hasValidLocation = isPickup || hasLocation;

        const isValid = isValidPackageCode && isValidPhone && hasValidLocation;
        
        DOM.submitBtn.disabled = !isValid || AppState.isSubmitting;

        console.log('🔍 Estado de validación:', {
            packageCode: isValidPackageCode,
            phone: isValidPhone,
            location: hasValidLocation,
            pickup: isPickup,
            overall: isValid
        });

        return isValid;
    }

    validatePackageCode() {
        const value = DOM.packageCodeInput.value.trim();
        const isValid = CONFIG.VALIDATION.PACKAGE_CODE.test(value);
        
        // Actualizar clases visuales
        DOM.packageCodeInput.classList.toggle('valid', isValid && value.length > 0);
        DOM.packageCodeInput.classList.toggle('invalid', !isValid && value.length > 0);
        
        // Mensaje de validación
        if (value.length === 0) {
            DOM.packageCodeValidation.textContent = '';
        } else if (!isValid) {
            DOM.packageCodeValidation.textContent = 'El código debe empezar con 6 y tener 13 dígitos';
        } else {
            DOM.packageCodeValidation.textContent = '';
        }
        
        return isValid;
    }

    validatePhone() {
        const value = DOM.phoneInput.value.replace(/\D/g, '');
        const isValid = CONFIG.VALIDATION.PHONE.test(value);
        
        // Actualizar clases visuales
        DOM.phoneInput.classList.toggle('valid', isValid && value.length > 0);
        DOM.phoneInput.classList.toggle('invalid', !isValid && value.length > 0);
        
        // Mensaje de validación
        if (value.length === 0) {
            DOM.phoneValidation.textContent = '';
        } else if (!isValid) {
            DOM.phoneValidation.textContent = 'El teléfono debe tener 9 dígitos';
        } else {
            DOM.phoneValidation.textContent = '';
        }
        
        return isValid;
    }

    formatPhone() {
        let value = DOM.phoneInput.value.replace(/\D/g, '');
        
        // Limitar a 9 dígitos
        if (value.length > 9) {
            value = value.substring(0, 9);
        }
        
        // Formatear: 999 888 777
        if (value.length > 0) {
            const match = value.match(/(\d{0,3})(\d{0,3})(\d{0,3})/);
            if (match) {
                let formatted = match[1];
                if (match[2]) formatted += ' ' + match[2];
                if (match[3]) formatted += ' ' + match[3];
                value = formatted;
            }
        }
        
        DOM.phoneInput.value = value.trim();
    }

    // ===== MANEJO DE ENVÍO DEL FORMULARIO =====
    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm() || AppState.isSubmitting) {
            return;
        }

        const packageCode = DOM.packageCodeInput.value.trim();
        const phone = DOM.phoneInput.value.trim();
        
        console.log('📤 Iniciando envío del formulario...', {
            packageCode,
            phone,
            location: AppState.currentLocation
        });

        AppState.isSubmitting = true;
        this.disableForm();

        try {
            await this.processSubmission(packageCode, phone, AppState.currentLocation);
        } catch (error) {
            console.error('❌ Error en el envío:', error);
            this.showError(
                'Ocurrió un error al procesar tu solicitud. ' +
                'Por favor intenta nuevamente en unos momentos.',
                'Error de Envío'
            );
        } finally {
            AppState.isSubmitting = false;
            this.enableForm();
            this.validateForm();
        }
    }

    disableForm() {
        DOM.submitBtn.disabled = true;
        DOM.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }

    enableForm() {
        DOM.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span id="submitText">Registrar ubicación</span>';
        this.validateForm();
    }

    async processSubmission(packageCode, phone, location) {
        this.showLoading('Guardando tu información...');

        try {
            // Intentar guardar en el sistema principal
            const result = await this.saveRegistration(packageCode, phone, location);
            
            this.hideLoading();
            
            if (result.success) {
                this.showSuccessMessage(packageCode, phone, location, result);
            } else {
                throw new Error(result.error || 'Error desconocido al guardar');
            }
            
        } catch (error) {
            this.hideLoading();
            throw error;
        }
    }

    async saveRegistration(packageCode, phone, location) {
        // Por ahora, siempre usar localStorage
        // En el futuro, aquí puedes agregar Google Sheets o backend
        return this.saveToLocalStorage(packageCode, phone, location);
    }

    // ===== SISTEMA DE ALMACENAMIENTO =====
    saveToLocalStorage(packageCode, phone, location) {
        try {
            const registration = {
                id: Date.now(),
                packageCode,
                phone: phone.replace(/\D/g, ''),
                latitude: location.latitude,
                longitude: location.longitude,
                isPickup: location.isPickup || false,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                source: 'localStorage'
            };
            
            const existing = this.getLocalStorageData();
            existing.unshift(registration);
            
            localStorage.setItem('locationRegistrations', JSON.stringify(existing));
            
            console.log('💾 Registro guardado en localStorage:', registration);
            
            return {
                success: true,
                message: 'Registro guardado localmente',
                registration,
                storage: 'localStorage'
            };
            
        } catch (error) {
            console.error('❌ Error guardando en localStorage:', error);
            return {
                success: false,
                error: 'No se pudo guardar el registro'
            };
        }
    }

    getLocalStorageData() {
        try {
            return JSON.parse(localStorage.getItem('locationRegistrations') || '[]');
        } catch (error) {
            console.error('❌ Error leyendo localStorage:', error);
            return [];
        }
    }

    // ===== INTERFAZ DE USUARIO =====
    showLocationStatus(message, type = 'default') {
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'info' ? 'fa-info-circle' : 'fa-crosshairs';
        
        DOM.locationStatus.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        DOM.locationStatus.className = `location-status ${type}`;
    }

    showLocationSuccess(lat, lng) {
        this.showLocationStatus(
            `Ubicación obtenida: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            'success'
        );
    }

    showSuccessMessage(packageCode, phone, location, result) {
        const timestamp = new Date().toLocaleString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const isPickup = location.isPickup === true;
        
        let detailsHTML = '';
        
        if (isPickup) {
            detailsHTML = `
                <div style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border-radius: 8px;">
                    <h4 style="color: #1976d2; margin-bottom: 8px;">
                        <i class="fas fa-store"></i> Recojo en ${CONFIG.APP.PICKUP_LOCATION.name}
                    </h4>
                    <p style="color: #1565c0; margin: 0;">
                        ✅ <strong>Un asesor se contactará contigo para coordinar el recojo</strong>
                    </p>
                </div>
            `;
        }
        
        detailsHTML += `
            <div><strong>📦 Código:</strong> ${packageCode}</div>
            <div><strong>📞 Teléfono:</strong> ${phone}</div>
            ${!isPickup ? `<div><strong>📍 Ubicación:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>` : ''}
            <div><strong>📅 Fecha:</strong> ${timestamp}</div>
            <div><strong>💾 Guardado en:</strong> ${result.storage === 'localStorage' ? 'Dispositivo local' : 'Sistema'}</div>
        `;

        DOM.successDetails.innerHTML = detailsHTML;

        // Ocultar elementos
        DOM.mapContainerMobile.classList.add('hidden');
        DOM.mapContainerDesktop.classList.add('hidden');
        DOM.locationForm.parentElement.classList.add('hidden');
        
        // Mostrar éxito
        DOM.successMessage.classList.remove('hidden');
        
        // Scroll suave al inicio
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log('✅ Registro completado exitosamente');
    }

    resetForm() {
        // Limpiar campos
        DOM.packageCodeInput.value = '';
        DOM.phoneInput.value = '';
        DOM.pickupCheckbox.checked = false;
        AppState.currentLocation = null;
        
        // Resetear UI
        DOM.locationSection.style.display = 'block';
        this.showLocationStatus('Haz clic en el botón para obtener tu ubicación', 'default');
        
        DOM.getLocationBtn.disabled = false;
        DOM.getLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Obtener mi ubicación';
        
        DOM.submitText.textContent = 'Registrar ubicación';
        
        // Ocultar mapas
        DOM.mapContainerMobile.classList.add('hidden');
        DOM.mapContainerDesktop.classList.add('hidden');
        
        // Resetear validación visual
        DOM.packageCodeInput.classList.remove('valid', 'invalid');
        DOM.phoneInput.classList.remove('valid', 'invalid');
        DOM.packageCodeValidation.textContent = '';
        DOM.phoneValidation.textContent = '';
        
        // Mostrar formulario, ocultar éxito
        DOM.locationForm.parentElement.classList.remove('hidden');
        DOM.successMessage.classList.add('hidden');
        
        // Enfocar primer campo
        this.autoFocusFirstField();
        
        console.log('🔄 Formulario reiniciado');
    }

    // ===== SISTEMA DE MAPAS =====
    showMaps(lat, lng) {
        if (!this.isValidCoordinates(lat, lng)) {
            console.error('❌ Coordenadas inválidas:', lat, lng);
            this.showError('Las coordenadas obtenidas no son válidas.', 'Error de Ubicación');
            return;
        }

        DOM.mapContainerMobile.classList.remove('hidden');
        DOM.mapContainerDesktop.classList.remove('hidden');
        
        this.initMobileMap(lat, lng);
        this.initDesktopMap(lat, lng);
        this.updateMapCoords(lat, lng);
    }

    isValidCoordinates(lat, lng) {
        return !isNaN(lat) && !isNaN(lng) &&
               lat >= CONFIG.VALIDATION.COORDINATES.LAT.min && 
               lat <= CONFIG.VALIDATION.COORDINATES.LAT.max &&
               lng >= CONFIG.VALIDATION.COORDINATES.LNG.min && 
               lng <= CONFIG.VALIDATION.COORDINATES.LNG.max;
    }

    initMobileMap(lat, lng) {
        try {
            if (!AppState.mapMobile) {
                console.log('📱 Inicializando mapa móvil...');
                
                AppState.mapMobile = L.map('mapMobile').setView([lat, lng], 16);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(AppState.mapMobile);
                
                AppState.markerMobile = L.marker([lat, lng], {
                    draggable: true,
                    title: 'Arrastra para ajustar tu ubicación'
                }).addTo(AppState.mapMobile);
                
                AppState.markerMobile.bindPopup(
                    '<b>📍 Tu ubicación</b><br>Arrastra el marcador para ajustar la posición exacta'
                ).openPopup();
                
                AppState.markerMobile.on('dragend', (e) => {
                    const position = e.target.getLatLng();
                    this.updateLocation(position.lat, position.lng);
                });
                
                AppState.mapMobile.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    AppState.markerMobile.setLatLng([lat, lng]);
                    this.updateLocation(lat, lng);
                });
                
                console.log('✅ Mapa móvil inicializado');
            } else {
                AppState.mapMobile.setView([lat, lng], 16);
                AppState.markerMobile.setLatLng([lat, lng]);
            }
            
            // Ajustar tamaño después de mostrar
            setTimeout(() => {
                if (AppState.mapMobile) {
                    AppState.mapMobile.invalidateSize();
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error inicializando mapa móvil:', error);
        }
    }

    initDesktopMap(lat, lng) {
        try {
            if (!AppState.mapDesktop) {
                console.log('💻 Inicializando mapa desktop...');
                
                AppState.mapDesktop = L.map('mapDesktop').setView([lat, lng], 16);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(AppState.mapDesktop);
                
                AppState.markerDesktop = L.marker([lat, lng], {
                    draggable: true,
                    title: 'Arrastra para ajustar tu ubicación'
                }).addTo(AppState.mapDesktop);
                
                AppState.markerDesktop.bindPopup(
                    '<b>📍 Tu ubicación</b><br>Arrastra el marcador para ajustar la posición exacta'
                ).openPopup();
                
                AppState.markerDesktop.on('dragend', (e) => {
                    const position = e.target.getLatLng();
                    this.updateLocation(position.lat, position.lng);
                });
                
                AppState.mapDesktop.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    AppState.markerDesktop.setLatLng([lat, lng]);
                    this.updateLocation(lat, lng);
                });
                
                console.log('✅ Mapa desktop inicializado');
            } else {
                AppState.mapDesktop.setView([lat, lng], 16);
                AppState.markerDesktop.setLatLng([lat, lng]);
            }
            
            // Ajustar tamaño después de mostrar
            setTimeout(() => {
                if (AppState.mapDesktop) {
                    AppState.mapDesktop.invalidateSize();
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error inicializando mapa desktop:', error);
        }
    }

    updateLocation(lat, lng) {
        if (!this.isValidCoordinates(lat, lng)) {
            console.error('❌ Coordenadas inválidas al actualizar:', lat, lng);
            this.showError('Las coordenadas seleccionadas no son válidas.', 'Error de Ubicación');
            return;
        }

        try {
            AppState.currentLocation = { latitude: lat, longitude: lng };
            
            if (AppState.markerMobile) AppState.markerMobile.setLatLng([lat, lng]);
            if (AppState.markerDesktop) AppState.markerDesktop.setLatLng([lat, lng]);
            
            this.updateMapCoords(lat, lng);
            this.showLocationSuccess(lat, lng);
            this.validateForm();
            
        } catch (error) {
            console.error('❌ Error actualizando ubicación:', error);
            this.showError('Error al actualizar la ubicación en el mapa.');
        }
    }

    updateMapCoords(lat, lng) {
        const coordText = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        if (DOM.mapCoordsMobile) DOM.mapCoordsMobile.textContent = coordText;
        if (DOM.mapCoordsDesktop) DOM.mapCoordsDesktop.textContent = coordText;
    }

    // ===== UTILIDADES DE UI =====
    showLoading(message = 'Procesando...') {
        if (DOM.loadingText) {
            DOM.loadingText.textContent = message;
        }
        DOM.loading.classList.remove('hidden');
    }

    hideLoading() {
        DOM.loading.classList.add('hidden');
    }

    showError(message, title = 'Error') {
        if (DOM.errorTitle) {
            DOM.errorTitle.textContent = title;
        }
        
        // Convertir saltos de línea en <br> para mejor formato
        const formattedMessage = message.replace(/\n/g, '<br>');
        DOM.errorMessage.innerHTML = formattedMessage;
        DOM.errorModal.classList.remove('hidden');
        
        console.error(`❌ ${title}:`, message);
    }

    closeError() {
        DOM.errorModal.classList.add('hidden');
    }

    // ===== UTILIDADES GENERALES =====
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== MÉTODOS PÚBLICOS PARA HTML =====
    getCurrentLocation() {
        this.getCurrentLocation();
    }

    handleSubmit(e) {
        this.handleSubmit(e);
    }

    resetForm() {
        this.resetForm();
    }

    closeError() {
        this.closeError();
    }
}

// ===== INICIALIZACIÓN AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar la aplicación
    window.app = new LogisticTrackApp();
    
    // Hacer métodos globales disponibles para onclick en HTML
    window.getCurrentLocation = () => window.app.getCurrentLocation();
    window.handleSubmit = (e) => window.app.handleSubmit(e);
    window.resetForm = () => window.app.resetForm();
    window.closeError = () => window.app.closeError();
    
    console.log('✅ Aplicación completamente inicializada');
});

// Manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('🔥 Error global capturado:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('🔥 Promise rechazada no manejada:', e.reason);
});