import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ConnectionStatus, Network } from '@capacitor/network';
import { ToastController, NavController, AlertController, LoadingController } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import * as L from 'leaflet';

import { ApiService, MidagriProductor, ReniecResponse } from './api.service';

// Reutilizamos la interfaz de propiedades
export interface ValidationResult {
  isValid: boolean;
  missing: string[];
}

// Reutilizamos la interfaz de propiedades
interface GeoJsonProperties {
  name: string;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string;
  celular_participante: string;
  txt_codigoautogenerado: string;
  fec_registro: string;
  txt_actagraria: string;
  num_superficie: string;
  txt_regtenencia: string;
  txt_sexo: string;
  txt_departamento: string;
  txt_provincia: string;
  txt_distrito: string;
  tipo_productor: string;
  dni_photo_front: string;
  dni_photo_back: string;
  tipo_cultivo: string;
  ubigeo_oficina_zonal: string;
  ubigeo_departamento: string;
  ubigeo_provincia: string;
  ubigeo_distrito: string;
  ubigeo_caserio: string;
  fuente: string;
  datum: string;
  observaciones: string;
  photos: string[];
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegisterDataService {

  private isOnline = true;

  // --- Estado Reactivo con BehaviorSubjects ---
  private readonly _geojson = new BehaviorSubject<any>(null);
  readonly geojson$ = this._geojson.asObservable();

  private readonly _editKey = new BehaviorSubject<string | null>(null);
  readonly editKey$ = this._editKey.asObservable();

  private readonly _photosForDisplay = new BehaviorSubject<string[]>([]);
  readonly photosForDisplay$ = this._photosForDisplay.asObservable();

  private readonly _savedPhotoUris = new BehaviorSubject<string[]>([]);

  private readonly _formData = new BehaviorSubject({
    dni: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    celular_participante: '',
    txt_codigoautogenerado: '',
    fec_registro: '',
    txt_actagraria: '',
    num_superficie: '',
    txt_regtenencia: '',
    txt_sexo: '',
    txt_departamento: '',
    txt_provincia: '',
    txt_distrito: '',
    perimetro: '',
    area: '',
    altitud: '',
    centroide: '',
    tipo_productor: '',
    geometryTypeLabel: '',
    dni_photo_front: '',
    dni_photo_back: '',
    tipo_cultivo: '',
    ubigeo_oficina_zonal: '',
    ubigeo_departamento: '',
    ubigeo_provincia: '',
    ubigeo_distrito: '',
    ubigeo_caserio: '',
    fuente: 'DEVIDA',
    datum: 'WGS-84',
    observaciones: '',
  });
  readonly formData$ = this._formData.asObservable();

  constructor(
    private router: Router,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private zone: NgZone,
    private apiService: ApiService
  ) {
    this.initializeNetworkListener();
  }

  // --- Métodos de Inicialización y Carga ---

  private async initializeNetworkListener() {
    // Espera a que la plataforma esté lista para evitar errores en el arranque
    await new Promise(resolve => setTimeout(resolve, 500));

    const status = await Network.getStatus();
    this.isOnline = status.connected;

    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      // Solo actuar si el estado de la conexión realmente ha cambiado
      if (this.isOnline === status.connected) {
        return;
      }

      this.isOnline = status.connected;
      // Usamos NgZone para asegurar que los cambios se reflejen en la UI
      this.zone.run(async () => {
        if (this.isOnline) { // Transición de offline a online
          await this.showToast('Conexión recuperada. Iniciando sincronización...', 'success');
          this.syncPendingProductorData();
        } else { // Transición de online a offline
          await this.showToast('Estás sin conexión. Se guardarán los datos localmente.', 'warning');
        }
      });
    });
  }

  private async syncPendingProductorData() {
    console.log('Iniciando proceso de sincronización de registros pendientes...');
    const { keys } = await Preferences.keys();
    const recordKeys = keys.filter(k => k.startsWith('polygon_') || k.startsWith('point_') || k.startsWith('linestring_'));
    let syncedCount = 0;

    for (const key of recordKeys) {
      const { value } = await Preferences.get({ key });
      if (!value) continue;

      try {
        const geojson = JSON.parse(value);
        const properties = geojson.properties as GeoJsonProperties;

        // Condición: El registro está marcado como pendiente de sincronización.
        if (properties && (properties as any).syncStatus === 'pending') {
          console.log(`Registro ${key} con DNI ${properties.dni} necesita sincronización.`);
          const fetchedData = await this.fetchProductorDataForSync(properties.dni);

          if (fetchedData) {
            // Fusionar los datos nuevos con los existentes y guardar
            Object.assign(properties, fetchedData);
            properties.name = `${properties.nombres || ''} ${properties.apellido_paterno || ''} ${properties.apellido_materno || ''}`.trim();
            properties.updatedAt = new Date().toISOString();
            delete (properties as any).syncStatus; // Elimina el flag de pendiente
            await Preferences.set({ key, value: JSON.stringify(geojson) });
            syncedCount++;
            console.log(`Registro ${key} sincronizado y guardado.`);

            // Si el usuario está viendo este registro, actualizamos la UI en tiempo real
            if (this._editKey.getValue() === key) {
              this.zone.run(() => this.loadFormDataFromProperties(properties));
            }
          }
        }
      } catch (error) {
        console.error(`Error procesando la sincronización para la clave ${key}:`, error);
      }
    }

    if (syncedCount > 0) {
      await this.showToast(`${syncedCount} registro(s) ha(n) sido sincronizado(s) con éxito.`, 'success');
    } else {
      console.log('No hay registros pendientes de sincronización.');
    }
  }

  public async loadInitialData(key: string | null, navigationState: any) {
    this.resetState();

    if (key) {
      // MODO EDICIÓN
      this._editKey.next(key);
      console.log('Modo edición por URL. Clave:', key);
      const { value } = await Preferences.get({ key });
      if (value) {
        const geojson = JSON.parse(value);
        this._geojson.next(geojson);
        this.calculateGeometryData();
        if (geojson?.properties) {
          this.loadFormDataFromProperties(geojson.properties);
          if (geojson.properties.photos && Array.isArray(geojson.properties.photos)) {
            this._savedPhotoUris.next(geojson.properties.photos);
            await this.loadPhotosForDisplay();
          }
        }
      } else {
        console.error('No se encontró el polígono para la clave:', key);
        await this.showToast('Error: No se pudo cargar el polígono para editar.', 'danger');
        this.navCtrl.navigateBack('/mapa');
      }
    } else if (navigationState && navigationState.geojson) {
      // MODO CREACIÓN
      const geojson = navigationState.geojson;
      this._geojson.next(geojson);
      this.calculateGeometryData();
      console.log('Modo creación de nuevo polígono.');
    } else {
      console.warn('Página de registro abierta sin GeoJSON para crear o clave para editar.');
    }
  }

  private resetState() {
    this._geojson.next(null);
    this._editKey.next(null);
    this._photosForDisplay.next([]);
    this._savedPhotoUris.next([]);
    this._formData.next({
      dni: '', nombres: '', apellido_paterno: '', apellido_materno: '',
      fecha_nacimiento: '', celular_participante: '', txt_codigoautogenerado: '',
      fec_registro: '', txt_actagraria: '',
      num_superficie: '', txt_regtenencia: '', txt_sexo: '',
      txt_departamento: '', txt_provincia: '', txt_distrito: '',
      perimetro: '', area: '', altitud: '', centroide: '',
      geometryTypeLabel: '',
      tipo_productor: '',
      dni_photo_front: '',
      dni_photo_back: '',
      tipo_cultivo: '',
      ubigeo_oficina_zonal: '',
      ubigeo_departamento: '',
      ubigeo_provincia: '',
      ubigeo_distrito: '',
      ubigeo_caserio: '',
      fuente: 'DEVIDA',
      datum: 'WGS-84',
      observaciones: '',
    });
  }

  private loadFormDataFromProperties(properties: any) {
    const currentData = this._formData.getValue();
    currentData.dni = properties.dni || '';
    currentData.nombres = properties.nombres || '';
    currentData.apellido_paterno = properties.apellido_paterno || '';
    currentData.apellido_materno = properties.apellido_materno || '';
    currentData.fecha_nacimiento = properties.fecha_nacimiento || '';
    currentData.celular_participante = properties.celular_participante || '';
    currentData.txt_codigoautogenerado = properties.txt_codigoautogenerado || '';
    currentData.fec_registro = properties.fec_registro || '';
    currentData.txt_actagraria = properties.txt_actagraria || '';
    currentData.num_superficie = properties.num_superficie || '';
    currentData.txt_regtenencia = properties.txt_regtenencia || '';
    currentData.txt_sexo = properties.txt_sexo || '';
    currentData.txt_departamento = properties.txt_departamento || '';
    currentData.txt_provincia = properties.txt_provincia || '';
    currentData.txt_distrito = properties.txt_distrito || '';
    currentData.tipo_productor = properties.tipo_productor || '';
    currentData.dni_photo_front = properties.dni_photo_front || '';
    currentData.dni_photo_back = properties.dni_photo_back || '';
    currentData.tipo_cultivo = properties.tipo_cultivo || '';
    currentData.ubigeo_oficina_zonal = properties.ubigeo_oficina_zonal || '';
    currentData.ubigeo_departamento = properties.ubigeo_departamento || '';
    currentData.ubigeo_provincia = properties.ubigeo_provincia || '';
    currentData.ubigeo_distrito = properties.ubigeo_distrito || '';
    currentData.ubigeo_caserio = properties.ubigeo_caserio || '';
    currentData.fuente = properties.fuente || 'DEVIDA';
    currentData.datum = properties.datum || 'WGS-84';
    currentData.observaciones = properties.observaciones || '';

    if (!currentData.nombres && properties.name) {
      currentData.nombres = properties.name;
    }
    this._formData.next(currentData);
  }

  // --- Lógica de Negocio (extraída de registerdata.page.ts) ---

  public async searchDni(isSync: boolean = false) {
    const currentFormData = this._formData.getValue();
    if (!currentFormData.dni || currentFormData.dni.length !== 8) {
      await this.showToast('Por favor, ingrese un DNI válido de 8 dígitos.', 'warning');
      return;
    }

    // --- NUEVA LÓGICA OFFLINE ---
    if (!this.isOnline) {
      await this.showToast('Sin conexión. Nombres y apellidos se completarán al recuperar internet.', 'tertiary');
      // Limpiamos los datos por si había una búsqueda anterior para forzar la sincronización
      currentFormData.nombres = '';
      currentFormData.apellido_paterno = '';
      currentFormData.apellido_materno = '';
      this._formData.next(currentFormData);
      return; // Salimos del método para no hacer la llamada a la API
    }
    // --- FIN LÓGICA OFFLINE ---

    const loading = !isSync ? await this.loadingController.create({ message: 'Buscando DNI...' }) : null;
    if (loading) await loading.present();

    try {
      currentFormData.nombres = '';
      currentFormData.apellido_paterno = '';
      currentFormData.apellido_materno = '';
      currentFormData.txt_codigoautogenerado = '';
      currentFormData.fec_registro = '';
      currentFormData.txt_actagraria = '';
      currentFormData.num_superficie = '';
      currentFormData.txt_regtenencia = '';
      currentFormData.txt_sexo = '';
      currentFormData.txt_departamento = '';
      currentFormData.txt_provincia = '';
      currentFormData.txt_distrito = '';

      let reniecSuccess = false;
      let midagriSuccess = false;

      try {
        const reniecData: ReniecResponse | null = await this.apiService.getReniecData(currentFormData.dni);
        if (reniecData) {
          currentFormData.nombres = (reniecData.first_name || '').toUpperCase();
          currentFormData.apellido_paterno = (reniecData.first_last_name || '').toUpperCase();
          currentFormData.apellido_materno = (reniecData.second_last_name || '').toUpperCase();
          reniecSuccess = true;
        }
      } catch (err: any) {
        console.error('Error al consultar RENIEC:', err.message || err);
      }

      try {
        const productor: MidagriProductor | null = await this.apiService.getMidagriData(currentFormData.dni);
        if (productor) {
          currentFormData.txt_codigoautogenerado = productor.txt_codigoautogenerado || '';
          if (productor.fec_registro) {
            const date = new Date(productor.fec_registro);
            if (!isNaN(date.getTime())) {
              currentFormData.fec_registro = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            } else {
              currentFormData.fec_registro = productor.fec_registro;
            }
          }
          currentFormData.txt_actagraria = productor.txt_actagraria || '';
          currentFormData.num_superficie = productor.num_superficie || '';
          currentFormData.txt_regtenencia = productor.txt_regtenencia || '';
          currentFormData.txt_sexo = productor.txt_sexo || '';
          currentFormData.txt_departamento = productor.txt_departamento || '';
          currentFormData.txt_provincia = productor.txt_provincia || '';
          currentFormData.txt_distrito = productor.txt_distrito || '';
          midagriSuccess = true;
        }
      } catch (midagriError: any) {
        console.error('Error al consultar MIDAGRI:', midagriError.message || midagriError);
      }

      let toastMessage = '';
      let toastColor = 'danger';

      if (reniecSuccess && midagriSuccess) {
        toastMessage = 'Datos de RENIEC y MIDAGRI cargados.';
        toastColor = 'success';
      } else if (reniecSuccess) {
        toastMessage = 'Datos de RENIEC cargados. No se encontraron en MIDAGRI.';
        toastColor = 'warning';
      } else if (midagriSuccess) {
        toastMessage = 'Datos de MIDAGRI cargados. No se encontraron en RENIEC.';
        toastColor = 'warning';
      } else {
        toastMessage = 'DNI no encontrado en ninguna de las fuentes.';
        toastColor = 'danger';
      }

      // Rellenar campos si las búsquedas fallaron
      if (!reniecSuccess) {
        currentFormData.nombres = 'NO ENCONTRADO';
        currentFormData.apellido_paterno = 'NO ENCONTRADO';
        currentFormData.apellido_materno = 'NO ENCONTRADO';
      }
      if (!midagriSuccess) {
        currentFormData.txt_codigoautogenerado = 'NO REGISTRA';
        currentFormData.fec_registro = 'NO REGISTRA';
        currentFormData.txt_actagraria = 'NO REGISTRA';
        currentFormData.num_superficie = 'NO REGISTRA';
        currentFormData.txt_regtenencia = 'NO REGISTRA';
        currentFormData.txt_sexo = 'NO REGISTRA';
        currentFormData.txt_departamento = 'NO REGISTRA';
        currentFormData.txt_provincia = 'NO REGISTRA';
        currentFormData.txt_distrito = 'NO REGISTRA';
      }

      // Actualiza el estado del formulario una sola vez con todos los datos consolidados
      this._formData.next(currentFormData);

      // Solo mostramos el toast si NO es una sincronización automática
      if (!isSync) {
        await this.showToast(toastMessage, toastColor as any);
      }

    } finally {
      if (loading) await loading.dismiss();
    }
  }

  private async fetchProductorDataForSync(dni: string): Promise<Partial<GeoJsonProperties> | null> {
    if (!this.isOnline || !dni || dni.length !== 8) {
      return null;
    }

    const fetchedData: Partial<GeoJsonProperties> = {};
    let reniecSuccess = false;
    let midagriSuccess = false;

    try {
      const reniecData = await this.apiService.getReniecData(dni);
      if (reniecData) {
        fetchedData.nombres = (reniecData.first_name || '').toUpperCase();
        fetchedData.apellido_paterno = (reniecData.first_last_name || '').toUpperCase();
        fetchedData.apellido_materno = (reniecData.second_last_name || '').toUpperCase();
        reniecSuccess = true;
      }
    } catch (err) {
      console.error(`Sync Error (RENIEC) for DNI ${dni}:`, err);
    }

    try {
      const productor = await this.apiService.getMidagriData(dni);
      if (productor) {
        fetchedData.txt_codigoautogenerado = productor.txt_codigoautogenerado || '';
        if (productor.fec_registro) {
          const date = new Date(productor.fec_registro);
          fetchedData.fec_registro = !isNaN(date.getTime())
            ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
            : productor.fec_registro;
        }
        fetchedData.txt_actagraria = productor.txt_actagraria || '';
        fetchedData.num_superficie = productor.num_superficie || '';
        fetchedData.txt_regtenencia = productor.txt_regtenencia || '';
        fetchedData.txt_sexo = productor.txt_sexo || '';
        fetchedData.txt_departamento = productor.txt_departamento || '';
        fetchedData.txt_provincia = productor.txt_provincia || '';
        fetchedData.txt_distrito = productor.txt_distrito || '';
        midagriSuccess = true;
      }
    } catch (err) {
      console.error(`Sync Error (MIDAGRI) for DNI ${dni}:`, err);
    }

    if (!reniecSuccess) {
      fetchedData.nombres = 'NO ENCONTRADO';
      fetchedData.apellido_paterno = 'NO ENCONTRADO';
      fetchedData.apellido_materno = 'NO ENCONTRADO';
    }
    if (!midagriSuccess) {
      fetchedData.txt_codigoautogenerado = 'NO REGISTRA';
      fetchedData.fec_registro = 'NO REGISTRA';
      fetchedData.txt_actagraria = 'NO REGISTRA';
      fetchedData.num_superficie = 'NO REGISTRA';
      fetchedData.txt_regtenencia = 'NO REGISTRA';
      fetchedData.txt_sexo = 'NO REGISTRA';
      fetchedData.txt_departamento = 'NO REGISTRA';
      fetchedData.txt_provincia = 'NO REGISTRA';
      fetchedData.txt_distrito = 'NO REGISTRA';
    }

    return fetchedData;
  }

  public async saveData() {
    const formData = this._formData.getValue();

    // --- Validación de Campos Obligatorios ---
    const missingFields = [];
    // Campos siempre obligatorios
    if (!formData.dni) missingFields.push('DNI del productor');
    if (!formData.tipo_productor) missingFields.push('Tipo de Productor');
    if (!formData.celular_participante) missingFields.push('Número de celular');
    if (!formData.dni_photo_front) missingFields.push('Foto frontal del DNI');
    if (!formData.dni_photo_back) missingFields.push('Foto posterior del DNI');
    if (!formData.tipo_cultivo) missingFields.push('Tipo de Cultivo');

    // Validación de fecha de nacimiento
    if (!formData.fecha_nacimiento) {
      missingFields.push('Fecha de nacimiento');
    } else if (!this.isOfLegalAge(formData.fecha_nacimiento)) {
      missingFields.push('El productor debe ser mayor de 18 años');
    }

    // Validación de fotos adicionales
    if (this._savedPhotoUris.getValue().length < 2) {
      missingFields.push('Se requieren al menos 2 fotos adicionales');
    }

    // Campos obligatorios solo si hay conexión a internet
    if (this.isOnline && !formData.nombres) {
      missingFields.push('Nombres del productor');
    }

    if (missingFields.length > 0) {
      // Mostramos un toast con el primer campo faltante para guiar al usuario.
      await this.showToast(`Falta completar: ${missingFields[0]}`, 'warning');
      return;
    }

    const geojson = this._geojson.getValue();
    if (!geojson) {
      console.error('No hay GeoJSON para guardar.');
      return;
    }

    const isEditing = !!this._editKey.getValue();
    const geometryType = geojson.geometry.type.toLowerCase();
    let keyPrefix = 'polygon';
    if (geometryType.includes('point')) keyPrefix = 'point';
    else if (geometryType.includes('linestring')) keyPrefix = 'linestring';

    const key = isEditing ? this._editKey.getValue()! : `${keyPrefix}_${new Date().getTime()}`;
    let fullName = `${formData.nombres} ${formData.apellido_paterno} ${formData.apellido_materno}`.trim();

    const newProperties: GeoJsonProperties = {
      ...geojson.properties,
      name: fullName,
      dni: formData.dni,
      nombres: formData.nombres,
      apellido_paterno: formData.apellido_paterno,
      apellido_materno: formData.apellido_materno,
      fecha_nacimiento: formData.fecha_nacimiento,
      celular_participante: formData.celular_participante,
      txt_codigoautogenerado: formData.txt_codigoautogenerado,
      fec_registro: formData.fec_registro,
      txt_actagraria: formData.txt_actagraria,
      num_superficie: formData.num_superficie,
      txt_regtenencia: formData.txt_regtenencia,
      txt_sexo: formData.txt_sexo,
      txt_departamento: formData.txt_departamento,
      txt_provincia: formData.txt_provincia,
      txt_distrito: formData.txt_distrito,
      tipo_productor: formData.tipo_productor,
      dni_photo_front: formData.dni_photo_front,
      dni_photo_back: formData.dni_photo_back,
      tipo_cultivo: formData.tipo_cultivo,
      ubigeo_oficina_zonal: formData.ubigeo_oficina_zonal,
      ubigeo_departamento: formData.ubigeo_departamento,
      ubigeo_provincia: formData.ubigeo_provincia,
      ubigeo_distrito: formData.ubigeo_distrito,
      ubigeo_caserio: formData.ubigeo_caserio,
      fuente: formData.fuente,
      datum: formData.datum,
      observaciones: (formData.observaciones || '').toUpperCase(),
      photos: this._savedPhotoUris.getValue(),
    };

    // Si estamos offline y los nombres están vacíos, es un registro pendiente.
    if (!this.isOnline && !formData.nombres) {
      newProperties.name = 'PENDIENTE DE SINCRONIZACIÓN';
      newProperties.nombres = 'PENDIENTE';
      newProperties.apellido_paterno = '';
      newProperties.apellido_materno = '';
      (newProperties as any).syncStatus = 'pending';
    }

    if (isEditing) {
      newProperties.updatedAt = new Date().toISOString();
    } else {
      newProperties.createdAt = new Date().toISOString();
    }
    geojson.properties = newProperties;

    await Preferences.set({ key, value: JSON.stringify(geojson) });

    await this.showToast(
      isEditing ? 'Información actualizada con éxito' : 'Registro guardado con éxito',
      'success'
    );
    this.navCtrl.navigateBack('/mapa');
  }

  /**
   * Valida que los campos offline obligatorios estén completos.
   */
  public isProductorTabValid(): ValidationResult {
    const data = this._formData.getValue();
    const missing: string[] = [];

    if (!data.dni || data.dni.length !== 8) missing.push('DNI (8 dígitos)');
    if (!data.tipo_productor) missing.push('Tipo de productor');
    if (!data.celular_participante) missing.push('Número de celular');
    if (!data.dni_photo_front) missing.push('Foto frontal del DNI');
    if (!data.dni_photo_back) missing.push('Foto posterior del DNI');

    // Validación de fecha de nacimiento
    if (!data.fecha_nacimiento) {
      missing.push('Fecha de nacimiento');
    } else if (!this.isOfLegalAge(data.fecha_nacimiento)) {
      missing.push('El productor debe ser mayor de 18 años');
    }

    return {
      isValid: missing.length === 0,
      missing: missing,
    };
  }

  /**
   * Verifica si hay registros guardados localmente que están pendientes de sincronización.
   * @returns `true` si hay al menos un registro pendiente, `false` en caso contrario.
   */
  public async hasPendingSyncRecords(): Promise<boolean> {
    const { keys } = await Preferences.keys();
    const recordKeys = keys.filter(k => k.startsWith('polygon_') || k.startsWith('point_') || k.startsWith('linestring_'));

    for (const key of recordKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const geojson = JSON.parse(value);
          if (geojson.properties && (geojson.properties as any).syncStatus === 'pending') {
            return true; // Se encontró al menos un registro pendiente
          }
        } catch (e) { /* Ignorar errores de parseo al solo verificar */ }
      }
    }
    return false; // No se encontraron registros pendientes
  }

  // --- Lógica de Fotos ---

  public async takePicture() {
    if (this._photosForDisplay.getValue().length >= 6) {
      await this.showToast('Límite de 6 fotos alcanzado.', 'warning');
      return;
    }

    const permissions = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
      await this.showToast('Se necesitan permisos de cámara y galería.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Procesando foto...' });
    await loading.present();

    try {
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera
      });
      if (!image.base64String) return;

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      const coords = position.coords;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        throw new Error('Coordenadas inválidas o nulas recibidas del GPS.');
      }

      const date = new Date();
      const textLines = [
        `Lat: ${coords.latitude.toFixed(5)} Lon: ${coords.longitude.toFixed(5)}`,
        `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
      ];

      const imageWithOverlayBase64 = await this.addTextOverlayToImage(`data:image/jpeg;base64,${image.base64String}`, textLines);
      const fileName = `photo_${new Date().getTime()}.jpeg`;

      const savedFile = await Filesystem.writeFile({
        path: fileName, data: imageWithOverlayBase64, directory: Directory.Data
      });

      try {
        await Filesystem.writeFile({
          path: `GeoDAIS/${fileName}`, data: imageWithOverlayBase64, directory: Directory.Documents, recursive: true
        });
        await this.showToast('Copia de la foto guardada en la galería.', 'success');
      } catch (publicSaveError: any) {
        console.error('Error al guardar en almacenamiento público:', publicSaveError.message);
      }

      const currentSavedUris = this._savedPhotoUris.getValue();
      this._savedPhotoUris.next([...currentSavedUris, savedFile.uri]);
      const currentDisplayPhotos = this._photosForDisplay.getValue();
      this._photosForDisplay.next([...currentDisplayPhotos, Capacitor.convertFileSrc(savedFile.uri)]);

    } catch (error: any) {
      const errorMessage = error.message || JSON.stringify(error);
      console.error('Error al tomar la foto:', errorMessage);
      await this.showToast(`Error: ${errorMessage}`, 'danger', 5000);
    } finally {
      await loading.dismiss();
    }
  }

  public async deletePhoto(index: number) {
    const alert = await this.alertController.create({
      header: 'Confirmar', message: '¿Estás seguro de que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            const uris = this._savedPhotoUris.getValue();
            const displayPhotos = this._photosForDisplay.getValue();
            const uriToDelete = uris[index];
            try {
              await Filesystem.deleteFile({ path: uriToDelete });
            } catch (e) {
              console.warn('No se pudo eliminar el archivo:', uriToDelete, e);
            }
            uris.splice(index, 1);
            displayPhotos.splice(index, 1);
            this._savedPhotoUris.next(uris);
            this._photosForDisplay.next(displayPhotos);
          }
        }
      ]
    });
    await alert.present();
  }

  public async takeDniPicture(side: 'front' | 'back') {
    const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
    if (permissions.camera !== 'granted') {
      await this.showToast('Se necesita permiso de cámara.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Procesando foto...' });
    await loading.present();

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri, // Usar URI es más eficiente
        source: CameraSource.Camera
      });

      if (!image.path) return;

      // Leemos el archivo de la ruta temporal que nos da la cámara
      const fileData = await Filesystem.readFile({
        path: image.path
      });

      const fileName = `dni_${side}_${new Date().getTime()}.jpeg`;

      // Si ya existe una foto para este lado, la eliminamos primero
      const currentFormData = this._formData.getValue();
      const existingUri = side === 'front' ? currentFormData.dni_photo_front : currentFormData.dni_photo_back;
      if (existingUri) {
        try {
          // El URI guardado ya es la ruta completa, no necesitamos especificar el directorio
          await Filesystem.deleteFile({ path: existingUri });
        } catch (e) {
          console.warn('No se pudo eliminar el archivo DNI anterior:', existingUri, e);
        }
      }

      // Escribimos el archivo en el directorio de datos de la app para obtener un URI permanente
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: fileData.data, // Usamos los datos en base64 leídos del archivo temporal
        directory: Directory.Data
      });

      // Guardar una copia en la carpeta pública 'GeoDAIS'
      try {
        await Filesystem.writeFile({
          path: `GeoDAIS/${fileName}`,
          data: fileData.data,
          directory: Directory.Documents,
          recursive: true
        });
        // No mostramos un toast aquí para no ser repetitivos con el de las otras fotos.
      } catch (publicSaveError: any) {
        console.error(`Error al guardar copia pública del DNI (${side}):`, publicSaveError.message);
      }

      // Actualizamos el estado del formulario con el URI completo y correcto
      if (side === 'front') {
        currentFormData.dni_photo_front = savedFile.uri;
      } else {
        currentFormData.dni_photo_back = savedFile.uri;
      }
      this._formData.next(currentFormData);

    } catch (error: any) {
      const errorMessage = error.message || JSON.stringify(error);
      if (errorMessage.toLowerCase().includes('user cancelled')) {
        console.log('Cámara cancelada por el usuario.');
        return; // No mostrar error si el usuario cancela
      }
      console.error('Error al tomar la foto del DNI:', errorMessage);
      await this.showToast(`Error: ${errorMessage}`, 'danger', 5000);
    } finally {
      await loading.dismiss();
    }
  }

  public async deleteDniPicture(side: 'front' | 'back') {
    const currentFormData = this._formData.getValue();
    const uriToDelete = side === 'front' ? currentFormData.dni_photo_front : currentFormData.dni_photo_back;

    if (uriToDelete) {
      try {
        // El URI guardado ya es la ruta completa, no necesitamos especificar el directorio
        await Filesystem.deleteFile({ path: uriToDelete });
      } catch (e) {
        console.warn('No se pudo eliminar el archivo DNI:', uriToDelete, e);
      }

      if (side === 'front') {
        currentFormData.dni_photo_front = '';
      } else {
        currentFormData.dni_photo_back = '';
      }
      this._formData.next(currentFormData);
    }
  }

  // --- Métodos Privados de Ayuda (Helper) ---

  private async loadPhotosForDisplay() {
    const displayPhotos: string[] = [];
    for (const fileUri of this._savedPhotoUris.getValue()) {
      displayPhotos.push(Capacitor.convertFileSrc(fileUri));
    }
    this._photosForDisplay.next(displayPhotos);
  }

  private calculateGeometryData() {
    const geojson = this._geojson.getValue();
    if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return;

    const geometryType = geojson.geometry.type;
    const data = this._formData.getValue();

    if (geometryType === 'Point') {
      data.geometryTypeLabel = 'Punto';
      const coords = geojson.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      data.centroide = `Lat: ${coords[1].toFixed(5)}, Lon: ${coords[0].toFixed(5)}`;
      data.altitud = (coords[2] !== undefined) ? `${coords[2].toFixed(2)} msnm` : 'No disponible';
      data.area = 'N/A (Punto)';
      data.perimetro = 'N/A (Punto)';
    } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      data.geometryTypeLabel = 'Línea';
      const coords = geometryType === 'LineString' ? geojson.geometry.coordinates : geojson.geometry.coordinates[0];
      if (!coords || coords.length < 2) return;
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));
      let length = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        length += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      data.perimetro = `${length.toFixed(2)} m`;
      data.area = 'N/A (Línea)';
      const center = L.polyline(latlngs).getBounds().getCenter();
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      data.altitud = this.calculateAverageAltitude(coords);
    } else { // Polygon or MultiPolygon
      data.geometryTypeLabel = 'Polígono';
      let coords = (geometryType === 'Polygon') ? geojson.geometry.coordinates[0] : geojson.geometry.coordinates[0][0];
      if (!coords || coords.length < 3) return;
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));
      const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
      data.area = `${(areaM2 / 10000).toFixed(4)} ha`;
      let perimeter = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        perimeter += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      if (latlngs.length > 0 && latlngs[0].distanceTo(latlngs[latlngs.length - 1]) > 1) {
        perimeter += latlngs[latlngs.length - 1].distanceTo(latlngs[0]);
      }
      data.perimetro = `${perimeter.toFixed(2)} m`;
      const center = L.polygon(latlngs).getBounds().getCenter();
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      data.altitud = this.calculateAverageAltitude(coords);
    }
    this._formData.next(data);
    // Iniciar autocompletado de ubigeo después de calcular los datos geométricos
    this.autocompletarUbicacion(geojson.geometry);
  }

  private calculateAverageAltitude(coords: any[]): string {
    const altitudes = coords.map((c: any[]) => c[2]).filter((alt: number | undefined) => alt !== undefined && typeof alt === 'number');
    if (altitudes.length > 0) {
      const sum = altitudes.reduce((a, b) => a + b, 0);
      return `${(sum / altitudes.length).toFixed(2)} msnm`;
    } else {
      return 'No disponible';
    }
  }

  private async autocompletarUbicacion(geometry: any) {
    if (!geometry) return;

    // Si ya existen datos de ubicación, no volvemos a buscarlos para evitar el toast.
    const existingData = this._formData.getValue();
    if (existingData.ubigeo_departamento || existingData.ubigeo_provincia || existingData.ubigeo_distrito) {
      console.log('Datos de ubicación ya existen, se omite la búsqueda automática.');
      return;
    }

    let point: { x: number, y: number };

    // Determinar el punto a consultar (centroide para líneas y polígonos)
    if (geometry.type === 'Point') {
      point = { x: geometry.coordinates[0], y: geometry.coordinates[1] };
    } else {
      let latlngs: L.LatLng[];
      if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
        const coords = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates[0];
        latlngs = coords.map((c: any) => L.latLng(c[1], c[0]));
        const center = L.polyline(latlngs).getBounds().getCenter();
        point = { x: center.lng, y: center.lat };
      } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const coords = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
        latlngs = coords.map((c: any) => L.latLng(c[1], c[0]));
        const center = L.polygon(latlngs).getBounds().getCenter();
        point = { x: center.lng, y: center.lat };
      } else {
        console.warn('Tipo de geometría no soportado para autocompletar ubigeo:', geometry.type);
        return;
      }
    }

    // --- Query for Distrito/Provincia/Departamento ---
    const ubigeoQueryParams = new URLSearchParams({
      geometry: JSON.stringify({ x: point.x, y: point.y }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'nombdep,nombprov,nombdist',
      returnGeometry: 'false',
      f: 'json'
    });
    const ubigeoUrl = `https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_DESARROLLO/MapServer/6/query?${ubigeoQueryParams.toString()}`;

    // --- Query for Oficina Zonal ---
    const zonalQueryParams = new URLSearchParams({
      geometry: JSON.stringify({ x: point.x, y: point.y }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OFICINA_ZO',
      returnGeometry: 'false',
      f: 'json'
    });
    const zonalUrl = `https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_DESARROLLO/MapServer/0/query?${zonalQueryParams.toString()}`;

    try {
      const [ubigeoResponse, zonalResponse] = await Promise.all([
        CapacitorHttp.get({ url: ubigeoUrl }),
        CapacitorHttp.get({ url: zonalUrl })
      ]);

      const currentFormData = this._formData.getValue();
      let ubigeoDataFound = false;

      // Process Ubigeo Response
      if (ubigeoResponse.status === 200 && ubigeoResponse.data && ubigeoResponse.data.features && ubigeoResponse.data.features.length > 0) {
        const attributes = ubigeoResponse.data.features[0].attributes;
        currentFormData.ubigeo_departamento = attributes.nombdep || '';
        currentFormData.ubigeo_provincia = attributes.nombprov || '';
        currentFormData.ubigeo_distrito = attributes.nombdist || '';
        ubigeoDataFound = true;
      }

      // Process Zonal Office Response
      if (zonalResponse.status === 200 && zonalResponse.data && zonalResponse.data.features && zonalResponse.data.features.length > 0) {
        const attributes = zonalResponse.data.features[0].attributes;
        currentFormData.ubigeo_oficina_zonal = attributes.OFICINA_ZO || 'FUERA DE LA OFICINA ZONAL';
      } else {
        currentFormData.ubigeo_oficina_zonal = 'FUERA DE LA OFICINA ZONAL';
      }

      // Update state immutably
      const updatedFormData = { ...currentFormData };
      this.zone.run(() => this._formData.next(updatedFormData));

      if (ubigeoDataFound) {
        await this.showToast('Datos de ubicación autocompletados.', 'success');
      }

    } catch (error: any) {
      console.error('Error al autocompletar ubicación:', error);
      await this.showToast(`No se pudo autocompletar la ubicación: ${error.message || 'Error de red'}`, 'warning');
    }
  }

  private addTextOverlayToImage(base64ImageData: string, textLines: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          if (img.width === 0 || img.height === 0) return reject(new Error('La imagen se cargó pero sus dimensiones son 0.'));
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No se pudo obtener el contexto 2D del canvas.'));

          const MAX_DIMENSION = 1920;
          let targetWidth = img.width, targetHeight = img.height;
          if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
              targetWidth = MAX_DIMENSION;
            } else {
              targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
              targetHeight = MAX_DIMENSION;
            }
          }
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const fontSize = Math.max(28, Math.floor(Math.min(targetWidth, targetHeight) / 35));
          const padding = fontSize * 0.7;
          const lineHeight = fontSize * 1.25;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.textAlign = 'left';

          const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
          const bgHeight = (lineHeight * textLines.length) + padding;
          const bgWidth = textWidth + (padding * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, canvas.height - bgHeight, bgWidth, bgHeight);

          ctx.fillStyle = 'white';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 5;
          let y = canvas.height - padding;
          for (let i = textLines.length - 1; i >= 0; i--) {
            ctx.fillText(textLines[i], padding, y);
            y -= lineHeight;
          }
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (err) => reject(new Error(`Error al cargar la imagen: ${JSON.stringify(err)}`));
      img.src = base64ImageData;
    });
  }

  private isOfLegalAge(birthDateString: string): boolean {
    if (!birthDateString) return false;
    // La fecha de ion-datetime viene en formato ISO 8601 (ej: "2006-01-01T00:00:00")
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) {
      console.error('Fecha de nacimiento inválida:', birthDateString);
      return false;
    }

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }

  public async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'tertiary' = 'tertiary', duration: number = 3000) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      position: 'middle',
      color: color,
    });
    await toast.present();
  }
}
