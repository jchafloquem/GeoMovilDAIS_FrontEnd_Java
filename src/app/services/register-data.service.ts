import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Device } from '@capacitor/device';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ConnectionStatus, Network } from '@capacitor/network';
import { ToastController, NavController, AlertController, LoadingController } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import * as L from 'leaflet';

import { ApiService, MidagriProductor, ReniecResponse, FotoRegistroPayload, ProductorRegistroPayload } from './api.service';
import { GpsDataService } from './gps-data.service';
import { AuthService } from './auth.service';

// Reutilizamos la interfaz de propiedades
export interface ValidationResult {
  isValid: boolean;
  missing: string[];
}

/**
 * Define la estructura de un objeto GeoJSON Feature para mejorar la seguridad de tipos.
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Partial<GeoJsonProperties>;
  geometry: {
    type: string;
    coordinates: any;
  };
}
// Reutilizamos la interfaz de propiedades
interface GeoJsonProperties {
  // Mapeo a la estructura de la base de datos
  internal_key?: string;
  fecha_creacion?: string;    // timestamptz
  fecha_actualizacion?: string; // timestamptz
  dni_productor: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
  // fecha_nacimiento se maneja como string ISO para el input, se formatea a DATE al enviar
  fecha_nacimiento: string;
  celular_participante: string;
  tipo_productor: string;
  sexo_midagri: string;
  // DATOS DEL MIDAGRI
  cod_ppa_midagri: string;
  fecha_registro_midagri: string;
  actividad_agraria_midagri: string;
  superficie_midagri: string | null;
  regimen_tenencia_midagri: string;
  departamento_midagri: string;
  provincia_midagri: string;
  distrito_midagri: string;
  // GEOMETRIA / INEI
  tipo_cultivo: string;
  oz_zonal: string;
  ubigeo_inei: string;
  departamento_inei: string;
  provincia_inei: string;
  distrito_inei: string;
  caserio: string;
  fuente: string;
  datum: string;
  observaciones: string;
  // PROFESIONAL
  profesional_dni: string;
  profesional_nombres: string;
  profesional_apellidos: string;
  profesional_celular: string;
  profesional_email: string;
  // AUDITORIA / LOCAL
  // Campos para almacenar códigos de ubigeo durante la sesión
  UBIGEO_DEPARTAMENTO?: string;
  UBIGEO_PROVINCIA?: string;
  UBIGEO_DISTRITO?: string;
  device_uuid: string;
  ruta_fotos: string[];
  ruta_dni_front: string;
  ruta_dni_back: string;
  // Campos de estado de la app
  status?: 'draft' | 'pending';
  syncStatus?: 'pending';
  // Campos calculados de geometría que también se persisten
  perimetro?: string;
  area?: string;
  altitud?: string;
  centroide?: string;
  latitud?: number;
  longitud?: number;
  geometryTypeLabel?: string;
  uploaded?: boolean; // Indica si el registro ya fue enviado al servidor
}

/**
 * Define la estructura de los datos que se mostrarán en la lista de registros.
 */
export interface SavedRecordSummary {
  key: string;
  name: string;
  type: string;
  icon: string;
  createdAt: string;
  thumbnail?: string;
  statusColor: 'danger' | 'warning' | 'success'; // Rojo, Ambar, Verde
  uploaded?: boolean; // Nuevo campo para controlar el bloqueo en la lista
}

const USER_PROFILE_KEY = 'userProfile';

@Injectable({
  providedIn: 'root'
})
export class RegisterDataService {

  private isOnline = true;

  // --- Estado Reactivo con BehaviorSubjects ---
  private readonly _geojson = new BehaviorSubject<GeoJSONFeature | null>(null);
  readonly geojson$ = this._geojson.asObservable();

  private readonly _editKey = new BehaviorSubject<string | null>(null);
  readonly editKey$ = this._editKey.asObservable();

  private readonly _photosForDisplay = new BehaviorSubject<string[]>([]);
  readonly photosForDisplay$ = this._photosForDisplay.asObservable();

  private readonly _savedPhotoUris = new BehaviorSubject<string[]>([]);

  private readonly _formData = new BehaviorSubject<Partial<GeoJsonProperties>>({
    dni_productor: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    celular_participante: '',
    cod_ppa_midagri: '',
    fecha_registro_midagri: '',
    actividad_agraria_midagri: '',
    superficie_midagri: null,
    regimen_tenencia_midagri: '',
    sexo_midagri: '',
    departamento_midagri: '',
    provincia_midagri: '',
    distrito_midagri: '',
    departamento_inei: '',
    provincia_inei: '',
    distrito_inei: '',
    tipo_productor: '',
    tipo_cultivo: '',
    oz_zonal: '',
    ubigeo_inei: '',
    caserio: '',
    fuente: 'DEVIDA',
    datum: 'WGS-84',
    observaciones: '',
    ruta_dni_front: '',
    ruta_dni_back: '',
  });
  readonly formData$ = this._formData.asObservable();

  constructor(
    private router: Router,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private zone: NgZone,
    private apiService: ApiService,
    private gpsDataService: GpsDataService,
    private authService: AuthService
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
        if (this.isOnline) {
          await this.showToast('Conexión recuperada. Iniciando sincronización...', 'success', 'middle');
          this.syncPendingProductorData();
          // Verificamos si hay registros listos para enviar y actualizamos la notificación
          this.updatePendingUploadNotification();
        } else {
          await this.showToast('Estás sin conexión. Se guardarán los datos localmente.', 'warning', 'middle');
        }
      });
    });
  }

  private async syncPendingProductorData() {
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
          // CORRECCIÓN: Usar el nuevo método centralizado y desestructurar la respuesta.
          const { data: fetchedData } = await this._fetchExternalProductorData(properties.dni_productor);

          geojson.properties = this.normalizeProperties(geojson);
          if (fetchedData && Object.keys(fetchedData).length > 0) {
            Object.assign(properties, fetchedData);
            properties.nombre_completo = `${properties.nombres || ''} ${properties.apellido_paterno || ''} ${properties.apellido_materno || ''}`.trim();
            properties.fecha_actualizacion = new Date().toISOString();
            delete (properties as any).syncStatus;

            const locationData = await this.autocompletarUbicacion(geojson.geometry, true, properties);
            if (locationData) {
              Object.assign(properties, locationData);
            }

            await Preferences.set({ key, value: JSON.stringify(geojson) });
            syncedCount++;

            // Si el usuario está viendo este registro, actualizamos la UI en tiempo real
            if (this._editKey.getValue() === key) {
              this.zone.run(() => this.loadFormDataFromProperties(properties));
            }
          }
        }
      } catch (error) {
        // Loguear error para trazabilidad sin interrumpir el bucle
        console.error(`[RegisterDataService] Error procesando registro pendiente ${key}:`, error);
      }
    }

    if (syncedCount > 0) {
      await this.showToast(`${syncedCount} registro(s) ha(n) sido sincronizado(s) con éxito.`, 'success', 'middle');
    }
  }

  public async loadInitialData(key: string | null, navigationState: any) {
    this.resetState();

    if (key) {
      // MODO EDICIÓN
      this._editKey.next(key);
      const { value } = await Preferences.get({ key });
      if (value) {
        const geojson = JSON.parse(value);
        geojson.properties = this.normalizeProperties(geojson);
        this._geojson.next(geojson);
        this.calculateGeometryData();
        if (geojson?.properties) {
          this.loadFormDataFromProperties(geojson.properties);
          if (geojson.properties.ruta_fotos && Array.isArray(geojson.properties.ruta_fotos)) {
            this._savedPhotoUris.next(geojson.properties.ruta_fotos);
            await this.loadPhotosForDisplay();
          }
        }
      } else {
        await this.showToast('Error: No se pudo cargar el polígono para editar.', 'danger', 'middle');
        this.navCtrl.navigateBack('/mapa');
      }
    } else if (navigationState && navigationState.geojson) {
      // MODO CREACIÓN
      const geojson = navigationState.geojson;
      this._geojson.next(geojson);
      this.calculateGeometryData();
    } else {
      console.warn('[RegisterDataService] loadInitialData llamado sin key ni estado de navegación.');
    }
  }

  private resetState() {
    this._geojson.next(null);
    this._editKey.next(null);
    this._photosForDisplay.next([]);
    this._savedPhotoUris.next([]);
    const resetData: Partial<GeoJsonProperties> = {
      dni_productor: '',
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      nombre_completo: '',
      fecha_nacimiento: '',
      celular_participante: '',
      tipo_productor: '',
      sexo_midagri: '',
      cod_ppa_midagri: '',
      fecha_registro_midagri: '',
      actividad_agraria_midagri: '',
      superficie_midagri: null,
      regimen_tenencia_midagri: '',
      departamento_midagri: '',
      provincia_midagri: '',
      distrito_midagri: '',
      tipo_cultivo: '',
      oz_zonal: '',
      ubigeo_inei: '',
      departamento_inei: '',
      provincia_inei: '',
      distrito_inei: '',
      caserio: '',
      fuente: 'DEVIDA',
      datum: 'WGS-84',
      observaciones: '',
      ruta_dni_front: '',
      ruta_dni_back: '',
      UBIGEO_DEPARTAMENTO: '',
      UBIGEO_PROVINCIA: '',
      UBIGEO_DISTRITO: '',
      // Resetear campos de geometría calculados
      perimetro: '', area: '', altitud: '', centroide: '',
      latitud: undefined, longitud: undefined,
      geometryTypeLabel: '',
    };
    this._formData.next(resetData);
  }

  /**
   * Actualiza los datos del formulario en el servicio.
   * El componente debe llamar a este método en cada cambio (input) para evitar pérdida de datos.
   */
  public updateFormData(patch: Partial<GeoJsonProperties>) {
    const current = this._formData.getValue();
    this._formData.next({ ...current, ...patch });
  }

  /**
   * Guarda el estado actual de la memoria en Preferences de forma silenciosa.
   * Esto evita que se pierdan datos si la app se reinicia al usar la cámara.
   */
  private async autoSaveState() {
    const key = this._editKey.getValue();
    const geojson = this._geojson.getValue();
    if (key && geojson) {
      const currentProps = this._formData.getValue();
      geojson.properties = { ...geojson.properties, ...currentProps, ruta_fotos: this._savedPhotoUris.getValue() };
      await Preferences.set({ key, value: JSON.stringify(geojson) });
    }
  }

  private loadFormDataFromProperties(properties: any) {
    // La carga es directa. Se priorizan los valores de geometría recién calculados
    // sobre los que pudieran estar guardados, que podrían estar obsoletos.
    const currentForm = this._formData.getValue();
    const newFormData = {
      ...properties,
      fuente: properties.fuente || 'DEVIDA',
      datum: properties.datum || 'WGS-84',
      perimetro: currentForm.perimetro,
      area: currentForm.area,
      // Priorizar la altitud calculada si es válida; si no, mantener la que ya estaba en propiedades
      altitud: (currentForm.altitud && currentForm.altitud !== 'No disponible') ? currentForm.altitud : (properties.altitud || 'No disponible'),
      centroide: currentForm.centroide,
      geometryTypeLabel: currentForm.geometryTypeLabel,
    };

    this._formData.next(newFormData);
  }

  // --- Lógica de Negocio (extraída de registerdata.page.ts) ---

  public async searchDni(isSync: boolean = false) {
    const currentFormData = this._formData.getValue();

    // BLOQUEO: Si el registro ya fue enviado, no permitir modificar datos vía búsqueda
    if (currentFormData.uploaded && !isSync) {
      await this.showToast('El registro ya fue enviado. No se pueden modificar los datos.', 'warning', 'middle');
      return;
    }

    if (!currentFormData.dni_productor || currentFormData.dni_productor.length !== 8) {
      await this.showToast('Por favor, ingrese un DNI válido de 8 dígitos.', 'warning', 'top');
      return;
    }

    // --- NUEVA LÓGICA OFFLINE ---
    if (!this.isOnline) {
      await this.showToast('Sin conexión. Nombres y apellidos se completarán al recuperar internet.', 'tertiary', 'top');
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
      const { data, message, color } = await this._fetchExternalProductorData(currentFormData.dni_productor!);

      // Actualiza el estado del formulario una sola vez con todos los datos consolidados
      this._formData.next({ ...currentFormData, ...data });

      // Solo mostramos el toast si NO es una sincronización automática
      if (!isSync) {
        await this.showToast(message, color, 'middle');
      }

    } finally {
      if (loading) await loading.dismiss();
    }
  }

  /**
   * Centraliza la lógica de búsqueda de datos de productor en RENIEC y MIDAGRI.
   * @param dni El DNI a consultar.
   * @returns Un objeto con los datos encontrados y la información para el toast.
   */
  private async _fetchExternalProductorData(dni: string): Promise<{ data: Partial<GeoJsonProperties>, message: string, color: 'success' | 'warning' | 'danger' }> {
    if (!this.isOnline || !dni || dni.length !== 8) {
      return { data: {}, message: 'Búsqueda no realizada (sin conexión o DNI inválido)', color: 'warning' };
    }

    const fetchedData: Partial<GeoJsonProperties> = {};
    let reniecSuccess = false;
    let midagriSuccess = false;

    try {
      const reniecData = await this.apiService.getReniecData(dni);
      if (reniecData) {
        fetchedData.nombres = (reniecData.first_name || 'NO ENCONTRADO').toUpperCase();
        fetchedData.apellido_paterno = (reniecData.first_last_name || 'NO ENCONTRADO').toUpperCase();
        fetchedData.apellido_materno = (reniecData.second_last_name || 'NO ENCONTRADO').toUpperCase();

        // Capturamos fecha de nacimiento y sexo si vienen de RENIEC
        if (reniecData.birthday) fetchedData.fecha_nacimiento = reniecData.birthday;
        if (reniecData.sex) {
          fetchedData.sexo_midagri = (reniecData.sex === 'M' || reniecData.sex === 'MASCULINO') ? 'M' : 'F';
        }
        reniecSuccess = true;
      }
    } catch (err) {
      console.warn('[RegisterDataService] Falló consulta a RENIEC:', err);
    }

    try {
      const productor = await this.apiService.getMidagriData(dni);
      if (productor) {
        // Mapeo exacto a columnas SQL varchar(30), date, numeric, etc.
        fetchedData.cod_ppa_midagri = productor.txt_codigoautogenerado || '';
        if (productor.fec_registro) {
          const date = new Date(productor.fec_registro);
          // Usar formato ISO para consistencia
          fetchedData.fecha_registro_midagri = !isNaN(date.getTime()) ? date.toISOString() : productor.fec_registro;
        }
        fetchedData.actividad_agraria_midagri = productor.txt_actagraria || '';
        fetchedData.superficie_midagri = productor.num_superficie || null;
        if (productor.txt_regtenencia) fetchedData.regimen_tenencia_midagri = productor.txt_regtenencia;
        if (productor.txt_sexo) {
          fetchedData.sexo_midagri = (productor.txt_sexo.toUpperCase().startsWith('M')) ? 'M' : 'F';
        } else {
          fetchedData.sexo_midagri = '';
        }
        fetchedData.departamento_midagri = (productor.txt_departamento || '').toUpperCase();
        fetchedData.provincia_midagri = (productor.txt_provincia || '').toUpperCase();
        fetchedData.distrito_midagri = (productor.txt_distrito || '').toUpperCase();

        midagriSuccess = true;
      }
    } catch (err) {
      console.warn('[RegisterDataService] Falló consulta a MIDAGRI:', err);
    }

    if (!reniecSuccess) {
      fetchedData.nombres = 'NO ENCONTRADO';
      fetchedData.apellido_paterno = 'NO ENCONTRADO';
      fetchedData.apellido_materno = 'NO ENCONTRADO';
    }
    if (!midagriSuccess) {
      // Asegurarse de que los campos queden vacíos o nulos si no se encuentran
      fetchedData.cod_ppa_midagri = fetchedData.cod_ppa_midagri ?? '';
      fetchedData.fecha_registro_midagri = fetchedData.fecha_registro_midagri ?? '';
      fetchedData.actividad_agraria_midagri = fetchedData.actividad_agraria_midagri ?? '';
      fetchedData.superficie_midagri = fetchedData.superficie_midagri ?? null;
      fetchedData.regimen_tenencia_midagri = fetchedData.regimen_tenencia_midagri ?? '';
      fetchedData.sexo_midagri = fetchedData.sexo_midagri ?? '';
      fetchedData.departamento_midagri = fetchedData.departamento_midagri ?? '';
      fetchedData.provincia_midagri = fetchedData.provincia_midagri ?? '';
      fetchedData.distrito_midagri = fetchedData.distrito_midagri ?? '';
    }

    let message = '', color: 'success' | 'warning' | 'danger' = 'danger';
    if (reniecSuccess && midagriSuccess) {
      message = 'Datos de RENIEC y MIDAGRI cargados.';
      color = 'success';
    } else if (reniecSuccess) {
      message = 'Datos de RENIEC cargados. No se encontraron en MIDAGRI.';
      color = 'warning';
    } else if (midagriSuccess) {
      message = 'Datos de MIDAGRI cargados. No se encontraron en RENIEC.';
      color = 'warning';
    } else {
      message = 'DNI no encontrado en ninguna de las fuentes.';
      color = 'danger';
    }

    return { data: fetchedData, message, color };
  }

  public async saveData() {
    const formData = this._formData.getValue();

    // BLOQUEO: Si ya fue enviado, no permitir guardar cambios
    if (formData.uploaded) {
      await this.showToast('Este registro ya fue enviado y no se puede editar.', 'warning', 'middle');
      return;
    }

    // --- Validación de Campos Obligatorios ---
    const missingFields = [];
    // Campos siempre obligatorios
    if (!formData.dni_productor) missingFields.push('DNI del productor');
    if (!formData.tipo_productor) missingFields.push('Tipo de Productor');
    if (!formData.celular_participante) missingFields.push('Número de celular');
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

    // Campos de ubicación e identificación (validados si hay internet)
    if (this.isOnline || (formData.nombres && formData.nombres !== 'PENDIENTE')) {
      if (!formData.nombres || formData.nombres === 'PENDIENTE' || formData.nombres === 'NO ENCONTRADO') {
        missingFields.push('Nombres del productor (búsqueda por DNI)');
      }
      if (!formData.oz_zonal) missingFields.push('Oficina Zonal');
      if (!formData.departamento_inei) missingFields.push('Departamento');
      if (!formData.provincia_inei) missingFields.push('Provincia');
      if (!formData.distrito_inei) missingFields.push('Distrito');
    }

    if (missingFields.length > 0) {
      // Mostramos un toast con el primer campo faltante para guiar al usuario.
      await this.showToast(`Falta completar: ${missingFields[0]}`, 'warning', 'top');
      return;
    }

    const geojson = this._geojson.getValue();
    if (!geojson) {
      return;
    }

    // --- Validación de Negocio: Restricción para rol de Cultivos (cultivos@devida.gob.pe) ---
    const role = await this.authService.getUserRole();
    const isPolygon = geojson.geometry.type.toLowerCase().includes('polygon');

    if (role === 'other-crops' && isPolygon) {
      const restricted = ['APICOLA', 'ACUICOLA', 'AVICOLA'];
      const currentTipo = (formData.tipo_cultivo || '').toUpperCase();
      if (restricted.includes(currentTipo)) {
        await this.showToast(`El rol de Cultivos no permite registrar polígonos para la actividad: ${currentTipo}`, 'warning', 'top');
        return;
      }
    }

    const isEditing = !!this._editKey.getValue();
    const geometryType = geojson.geometry.type.toLowerCase();
    let keyPrefix = 'polygon';
    if (geometryType.includes('point')) keyPrefix = 'point';
    else if (geometryType.includes('linestring')) keyPrefix = 'linestring';

    const key = isEditing ? this._editKey.getValue()! : `${keyPrefix}_${new Date().getTime()}`;
    const fullName = `${formData.nombres || ''} ${formData.apellido_paterno || ''} ${formData.apellido_materno || ''}`.trim();

    // Obtener datos del profesional y del dispositivo
    const deviceId = await Device.getId();
    const { value: profileValue } = await Preferences.get({ key: USER_PROFILE_KEY });
    const professionalProfile = profileValue ? JSON.parse(profileValue) : {};

    // Construimos las propiedades directamente desde el formData estandarizado
    const newProperties: Partial<GeoJsonProperties> = {
      ...formData,
      internal_key: key,
      nombre_completo: fullName,
      observaciones: (formData.observaciones || '').toUpperCase(),
      profesional_dni: professionalProfile.dni || null,
      profesional_nombres: professionalProfile.nombres || null,
      profesional_apellidos: `${professionalProfile.apellidoPaterno || ''} ${professionalProfile.apellidoMaterno || ''}`.trim(),
      profesional_celular: professionalProfile.celular || null,
      profesional_email: professionalProfile.email || null,
      device_uuid: deviceId.identifier,
      ruta_fotos: this._savedPhotoUris.getValue(),
      uploaded: false // Al guardar o editar, marcamos como NO subido para permitir el envío
    };

    // Si estamos editando un borrador, eliminamos el estado 'draft' al guardar los datos completos.
    if (geojson.properties?.status === 'draft') {
      delete newProperties.status;
    }

    // Lógica de estado PENDIENTE mejorada
    const isDataIncompleteForSync = !newProperties.nombres || newProperties.nombres === 'PENDIENTE' || newProperties.nombres === 'NO ENCONTRADO';
    if (!this.isOnline && isDataIncompleteForSync) {
      // Solo marcar como pendiente si estamos offline Y los datos de RENIEC/MIDAGRI faltan.
      newProperties.syncStatus = 'pending';
      newProperties.nombre_completo = `PENDIENTE (DNI: ${formData.dni_productor || 'S/N'})`;
      // Forzamos los campos de nombres a un estado pendiente para la sincronización, ignorando la entrada manual.
      if (!newProperties.nombres) newProperties.nombres = 'PENDIENTE';
      if (!newProperties.apellido_paterno) newProperties.apellido_paterno = '';
      if (!newProperties.apellido_materno) newProperties.apellido_materno = '';
    } else {
      // Si guardamos con conexión, nos aseguramos de que el registro no esté marcado como pendiente.
      // Esto es crucial al editar un registro que estaba pendiente y ahora se completa online.
      delete (newProperties as any).syncStatus;
    }


    if (isEditing) {
      newProperties.fecha_creacion = geojson.properties?.fecha_creacion;
      newProperties.fecha_actualizacion = new Date().toISOString();
    } else {
      newProperties.fecha_creacion = new Date().toISOString(); // timestamptz default
    }
    geojson.properties = newProperties;

    await Preferences.set({ key, value: JSON.stringify(geojson) });

    await this.showToast(
      isEditing ? 'Información actualizada con éxito' : 'Registro guardado con éxito',
      'success', 'middle', 3000,
      'checkmark-circle-outline'
    );

    this.navCtrl.navigateBack('/mapa');

    // Actualizar notificación después de guardar
    this.updatePendingUploadNotification();

  }

  /**
   * Orquesta el proceso completo de envío de registros completos al backend.
   * Esta función reemplaza la lógica que estaba en el componente mapa.page.
   */
  public async sendAllCompletedRecords(): Promise<{ successCount: number, errorCount: number, total: number }> {
    if (!this.isOnline) {
      await this.showToast("Necesita conexión a internet para enviar los datos a DEVIDA.", "warning", "middle");
      return { successCount: 0, errorCount: 0, total: 0 };
    }

    const allRecords = await this.getAllRawRecords();
    // Filtramos: Solo registros completos que NO hayan sido subidos todavía
    const recordsToSend = allRecords.filter(rec =>
      this.isRecordComplete(rec.properties) && !rec.properties.uploaded
    );

    if (recordsToSend.length === 0) {
      await this.showToast("No hay registros pendientes de envío.", "warning", "middle");
      return { successCount: 0, errorCount: 0, total: 0 };
    }

    let successCount = 0;
    let errorCount = 0;
    const loading = await this.loadingController.create({
      message: `Enviando 0 de ${recordsToSend.length} registros...`,
      spinner: "crescent"
    });
    await loading.present();

    for (let i = 0; i < recordsToSend.length; i++) {
      const record = recordsToSend[i];
      loading.message = `Enviando ${i + 1} de ${recordsToSend.length}...`;

      try {
        // 1. Preparar la geometría en formato WKT
        const wktGeometry = this.geometryToWkt(record.geometry);

        // 2. Construir un payload LIMPIO para la API, mapeando explícitamente solo los campos necesarios.
        // Esto previene que se envíen campos antiguos o temporales del frontend.
        const props = record.properties as GeoJsonProperties;

        // Limpieza de valores numéricos (quitar ' ha', ' m', ' msnm') para la base de datos
        // Esto asegura que numeric(15,6) y numeric(12,4) no reciban strings con texto
        const parseNumeric = (val: string | null | undefined) => {
          if (!val) return null;
          const clean = val.toString().replace(/[^0-9.]/g, '');
          return clean ? parseFloat(clean) : null;
        };

        // Preparar array de fotos para la tabla 'fotos_registro'
        const fotosPayload: FotoRegistroPayload[] = [];
        const procesarFoto = async (tipo: string, ruta: string, index: number) => {
          if (!ruta) return;
          try {
            // Filesystem.readFile devuelve los datos en Base64 por defecto si no se especifica encoding
            const file = await Filesystem.readFile({ path: ruta });
            // Aseguramos que enviamos el string de datos
            const base64Data = typeof file.data === 'string' ? file.data : JSON.stringify(file.data);

            // Generamos un internalKey único para la foto
            const fotoUniqueKey = `${props.internal_key || 'reg'}_foto_${tipo}_${index}_${new Date().getTime()}`;

            fotosPayload.push({
              internalKey: fotoUniqueKey,
              tipoFoto: tipo,
              rutaFoto: base64Data,
              // El productor_key será asignado por Hibernate al procesar la lista fotosAsociadas
            });
          } catch (e) {
            console.warn(`No se pudo leer la foto ${ruta} para envío:`, e);
          }
        };

        if (props.ruta_dni_front) await procesarFoto('DNI_FRONT', props.ruta_dni_front, 0);
        if (props.ruta_dni_back) await procesarFoto('DNI_BACK', props.ruta_dni_back, 1);
        if (props.ruta_fotos) {
          for (let j = 0; j < props.ruta_fotos.length; j++) {
            await procesarFoto('PARCELA', props.ruta_fotos[j], j + 2);
          }
        }

        const payload: ProductorRegistroPayload = {
          internalKey: props.internal_key || '',
          dniProductor: props.dni_productor,
          nombreCompleto: props.nombre_completo,
          nombres: props.nombres,
          apellidoPaterno: props.apellido_paterno,
          apellidoMaterno: props.apellido_materno,
          fechaNacimiento: props.fecha_nacimiento ? props.fecha_nacimiento.substring(0, 10) : null,
          celularParticipante: props.celular_participante,
          tipoProductor: props.tipo_productor,
          sexoMidagri: props.sexo_midagri,

          // DATOS DEL MIDAGRI
          codPpaMidagri: props.cod_ppa_midagri,
          fechaRegistroMidagri: props.fecha_registro_midagri ? props.fecha_registro_midagri.substring(0, 10) : null,
          actividadAgrariaMidagri: props.actividad_agraria_midagri,
          superficieMidagri: props.superficie_midagri,
          regimenTenenciaMidagri: props.regimen_tenencia_midagri,
          departamentoMidagri: props.departamento_midagri,
          provinciaMidagri: props.provincia_midagri,
          distritoMidagri: props.distrito_midagri,

          // DATOS DE LA GEOMETRIA
          tipoCultivo: props.tipo_cultivo,
          ozZonal: props.oz_zonal,
          ubigeoInei: props.ubigeo_inei || props.UBIGEO_DISTRITO || null,
          departamentoInei: props.departamento_inei,
          provinciaInei: props.provincia_inei,
          distritoInei: props.distrito_inei,
          caserio: props.caserio,
          fuente: props.fuente,
          datum: props.datum,
          perimetro: parseNumeric(props.perimetro),
          area: parseNumeric(props.area),
          altitud: parseNumeric(props.altitud),
          latitud: typeof props.latitud === 'number' ? props.latitud : null,
          longitud: typeof props.longitud === 'number' ? props.longitud : null,
          observaciones: props.observaciones,

          // DATOS DEL PROFESIONAL
          profesionalDni: props.profesional_dni,
          profesionalNombres: props.profesional_nombres,
          profesionalApellidos: props.profesional_apellidos,
          profesionalCelular: props.profesional_celular,
          profesionalEmail: props.profesional_email,

          // AUDITORÍA Y ESPACIAL
          deviceUuid: props.device_uuid,
          geom: wktGeometry,
          centroide: (typeof props.longitud === 'number' && typeof props.latitud === 'number')
            ? `POINT(${props.longitud} ${props.latitud})`
            : null, // Formato WKT Point 2D
          fotosAsociadas: fotosPayload
        };

        // 3. Enviar el registro individual
        const response = await this.apiService.enviarRegistroIndividual(payload);

        if (response.status >= 200 && response.status < 300) {
          successCount++;
          // Marcamos el registro como subido para no reenviarlo
          record.properties.uploaded = true;
          const key = record.properties.internal_key;
          if (key) {
            await Preferences.set({ key, value: JSON.stringify(record) });
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`Error al enviar el registro ${record.properties.internal_key}:`, error);
      }
    }

    await loading.dismiss();

    // Informar al usuario del resultado
    const message = `Envío finalizado. Éxitos: ${successCount}, Fallos: ${errorCount}.`;
    await this.showToast(message, errorCount > 0 ? 'warning' : 'success', 'middle', 4000);
    this.updatePendingUploadNotification();

    return { successCount, errorCount, total: recordsToSend.length };
  }

  /**
   * Normaliza las propiedades de un registro para asegurar compatibilidad entre
   * versiones antiguas (UPPER_CASE) y nuevas (snake_case).
   */
  private normalizeProperties(geojson: any): GeoJsonProperties {
    const p = geojson.properties || {};
    const g = geojson.geometry || {};
    const normalized: any = { ...p };

    const mapping: { [key: string]: string } = {
      'DNI': 'dni_productor',
      'NOMBRES': 'nombres',
      'APELLIDO_PATERNO': 'apellido_paterno',
      'APELLIDO_MATERNO': 'apellido_materno',
      'NOMBRE_COMPLETO': 'nombre_completo',
      'FECHA_NACIMIENTO': 'fecha_nacimiento',
      'CELULAR_PARTICIPANTE': 'celular_participante',
      'TIPO_PRODUCTOR': 'tipo_productor',
      'TIPO_CULTIVO': 'tipo_cultivo',
      'RUTA_FOTOS': 'ruta_fotos',
      'UBIGEO_OFICINA_ZONAL': 'oz_zonal',
      'UBIGEO_DEPARTAMENTO': 'departamento_inei',
      'UBIGEO_PROVINCIA': 'provincia_inei',
      'UBIGEO_DISTRITO': 'distrito_inei',
      'INTERNAL_KEY': 'internal_key',
      'DEVICE_UUID': 'device_uuid',
      'SEXO': 'sexo_midagri'
    };

    for (const [oldKey, newKey] of Object.entries(mapping)) {
      if (p[oldKey] !== undefined && (normalized[newKey] === undefined || normalized[newKey] === '')) {
        normalized[newKey] = p[oldKey];
      }
    }

    // Asegurar que ruta_fotos sea siempre un array
    if (normalized.ruta_fotos && !Array.isArray(normalized.ruta_fotos)) {
      normalized.ruta_fotos = [normalized.ruta_fotos];
    }

    // Reparación de coordenadas (Centroide) para registros antiguos
    if ((typeof normalized.latitud !== 'number' || !normalized.latitud) && g.coordinates) {
      try {
        if (g.type === 'Point') {
          normalized.longitud = g.coordinates[0];
          normalized.latitud = g.coordinates[1];
        } else if (g.type === 'LineString' || g.type === 'Polygon') {
          const coords = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
          if (coords && coords.length > 0) {
            const latlngs = coords.map((c: any) => L.latLng(c[1], c[0]));
            const center = g.type === 'LineString' ? L.polyline(latlngs).getBounds().getCenter() : L.polygon(latlngs).getBounds().getCenter();
            normalized.latitud = center.lat;
            normalized.longitud = center.lng;
          }
        }
      } catch (e) {
        console.warn('[RegisterDataService] No se pudo reparar coordenadas en normalización', e);
      }
    }

    return normalized;
  }

  /**
   * Valida si un registro tiene todos los campos obligatorios para ser enviado.
   * Esta es la fuente de verdad para la validación.
   * @param props Las propiedades del registro GeoJSON.
   */
  public isRecordComplete(props: Partial<GeoJsonProperties>): boolean {
    if (!props) return false;

    const isDraft = props.status === 'draft';
    const isPendingSync = props.syncStatus === 'pending';

    if (isDraft || isPendingSync) return false;

    return !!(
      props.dni_productor && props.tipo_productor &&
      props.celular_participante &&
      props.tipo_cultivo &&
      props.fecha_nacimiento && this.isOfLegalAge(props.fecha_nacimiento) &&
      props.oz_zonal && props.departamento_inei &&
      props.provincia_inei && props.distrito_inei &&
      props.ruta_fotos && props.ruta_fotos.length >= 2 &&
      props.nombres && props.nombres !== 'PENDIENTE' && props.nombres !== 'NO ENCONTRADO' &&
      typeof props.latitud === 'number' && typeof props.longitud === 'number'
    );
  }

  /**
   * Convierte un objeto de geometría GeoJSON a su representación WKT (Well-Known Text).
   */
  private geometryToWkt(geometry: { type: string, coordinates: any }): string | null {
    if (!geometry || !geometry.coordinates) return null;

    // CORRECCIÓN: Asegurar que siempre haya 3 coordenadas (X Y Z) para cumplir con la columna GeometryZ de la BD.
    const coordToString = (coords: number[]) => {
      const x = coords[0]; // Longitud
      const y = coords[1]; // Latitud
      const zVal = coords.length > 2 ? Number(coords[2]) : 0;
      const z = isNaN(zVal) ? 0 : zVal;
      return `${x} ${y} ${z}`;
    };

    // Función auxiliar para cerrar y formatear anillos de polígonos
    const formatRing = (ring: any[]): string => {
      const coords = [...ring];
      if (coords.length > 0) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push(first);
        }
      }
      return `(${coords.map(coordToString).join(', ')})`;
    };

    switch (geometry.type) {
      case 'Point':
        return `POINT Z (${coordToString(geometry.coordinates)})`;
      case 'LineString':
        return `LINESTRING Z (${geometry.coordinates.map(coordToString).join(', ')})`;
      case 'Polygon':
        if (!geometry.coordinates[0]) return null; // Protección contra polígonos vacíos
        return `POLYGON Z (${geometry.coordinates.map(formatRing).join(', ')})`;
      case 'MultiLineString':
        return `MULTILINESTRING Z (${geometry.coordinates.map((line: any[]) => `(${line.map(coordToString).join(', ')})`).join(', ')})`;
      case 'MultiPolygon':
        return `MULTIPOLYGON Z (${geometry.coordinates.map((poly: any[]) => `(${poly.map(formatRing).join(', ')})`).join(', ')})`;
      default:
        return null;
    }
  }
  /**
   * Obtiene todos los registros guardados en su formato GeoJSON crudo.
   * @returns Una promesa que resuelve a un array de GeoJSON Features.
   */
  public async getAllRawRecords(): Promise<any[]> {
    const { keys } = await Preferences.keys();
    const recordKeys = keys.filter(k =>
      k.startsWith('polygon_') || k.startsWith('point_') || k.startsWith('linestring_')
    );

    const allRecords: any[] = [];
    for (const key of recordKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const geojson = JSON.parse(value);
          geojson.properties = this.normalizeProperties(geojson);
          allRecords.push(geojson);
        } catch (e) {
          console.error(`[RegisterDataService] Error al parsear registro ${key} de Preferences:`, e);
        }
      }
    }
    return allRecords;
  }

  /**
   * Obtiene todos los registros guardados y los devuelve ordenados por fecha de creación, del más nuevo al más antiguo.
   */
  public async getSortedSavedRecords(): Promise<SavedRecordSummary[]> {
    // 1. Obtener todas las claves de registros.
    const { keys } = await Preferences.keys();
    const recordKeys = keys.filter(k =>
      k.startsWith('polygon_') || k.startsWith('point_') || k.startsWith('linestring_')
    );

    // 2. Cargar todos los registros en un array intermedio para poder ordenarlos por sus propiedades.
    const allRecords: { key: string, geojson: any }[] = [];
    for (const key of recordKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          let geojson = JSON.parse(value);
          geojson.properties = this.normalizeProperties(geojson);
          allRecords.push({ key, geojson });
        } catch (e) {
          console.error(`[RegisterDataService] Error al parsear registro ${key} de Preferences:`, e);
        }
      }
    }

    // 3. Ordenar el array con la nueva lógica de prioridad.
    allRecords.sort((a, b) => {
      const propsA = a.geojson.properties || {};
      const propsB = b.geojson.properties || {};

      const isA_Incomplete = propsA.status === 'draft' || propsA.syncStatus === 'pending';
      const isB_Incomplete = propsB.status === 'draft' || propsB.syncStatus === 'pending';

      // Asignar un "score" de prioridad: 0 para incompletos, 1 para completos.
      const scoreA = isA_Incomplete ? 0 : 1;
      const scoreB = isB_Incomplete ? 0 : 1;

      // Primero, ordenar por estado (incompletos primero).
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      // Si el estado es el mismo, ordenar por fecha (el más nuevo primero).
      const timeA = parseInt(a.key.split('_')[1] || '0', 10);
      const timeB = parseInt(b.key.split('_')[1] || '0', 10);
      return timeB - timeA;
    });

    // 4. Mapear los registros ya ordenados al formato final que necesita la vista.
    return allRecords.map(record => {
      const props = record.geojson.properties || {};
      const geometryType = record.geojson.geometry?.type || 'Unknown';
      const thumbnailUrl = (props.ruta_fotos && props.ruta_fotos.length > 0) ? Capacitor.convertFileSrc(props.ruta_fotos[0]) : undefined;

      // --- Lógica para determinar el color del estado ---
      let statusColor: 'danger' | 'warning' | 'success' = 'success'; // Verde por defecto
      const isDraft = props.status === 'draft';
      const isPendingSync = props.syncStatus === 'pending';
      const isDataMissing = !this.isRecordComplete(props);

      if (isDraft) {
        statusColor = 'danger'; // Rojo
      } else if (isPendingSync || isDataMissing) {
        statusColor = 'warning'; // Ambar
      }

      return {
        key: record.key,
        name: props.nombre_completo || 'REGISTRO PENDIENTE',
        type: geometryType,
        icon: this.getIconForType(geometryType),
        createdAt: props.fecha_creacion ? new Date(props.fecha_creacion).toLocaleDateString('es-PE') : 'Fecha no disponible',
        thumbnail: thumbnailUrl,
        statusColor: statusColor,
        uploaded: !!props.uploaded
      };
    });
  }

  /**
   * Devuelve el nombre del ícono correspondiente al tipo de geometría.
   * @param type El tipo de geometría (e.g., 'Polygon', 'Point').
   */
  private getIconForType(type: string): string {
    if (type.includes('Polygon')) return 'shapes-outline';
    if (type.includes('LineString')) return 'analytics-outline';
    if (type.includes('Point')) return 'location-outline';
    return 'help-circle-outline';
  }

  /**
   * Elimina un registro guardado de Preferences.
   * @param key La clave del registro a eliminar.
   */
  public async deleteRecord(key: string): Promise<void> {
    const { value } = await Preferences.get({ key });

    // BLOQUEO: Si el registro ya fue enviado, impedimos eliminarlo desde el servicio
    if (value) {
      try {
        const geojson = JSON.parse(value);
        if (geojson.properties?.uploaded) {
          await this.showToast('Registro enviado. No se puede eliminar.', 'warning', 'middle');
        }
      } catch (e) {
        console.warn('Error al verificar estado uploaded al eliminar', e);
      }
    }

    // Aquí iría la lógica para eliminar las fotos del filesystem si es necesario.
    await Preferences.remove({ key });
  }

  /**
   * Guarda una geometría como un borrador inmediatamente después de ser creada en el mapa
   * y navega a la página de registro para completar los datos.
   * @param geojson El objeto GeoJSON de la nueva geometría.
   */
  public async createDraftAndNavigate(geojson: any) {
    if (!geojson || !geojson.geometry) {
      await this.showToast('Error al crear la geometría. Inténtalo de nuevo.', 'danger');
      return;
    }

    const geometryType = geojson.geometry.type.toLowerCase();
    let keyPrefix = 'polygon';
    if (geometryType.includes('point')) keyPrefix = 'point';
    else if (geometryType.includes('linestring')) keyPrefix = 'linestring';

    const key = `${keyPrefix}_${new Date().getTime()}`;

    // Asignamos propiedades mínimas para el borrador
    geojson.properties = {
      nombre_completo: 'NUEVO REGISTRO (PENDIENTE)',
      fecha_creacion: new Date().toISOString(),
      status: 'draft', // Marcamos como borrador
    };

    await Preferences.set({ key, value: JSON.stringify(geojson) });
    this.navCtrl.navigateForward(`/mapa/registerdata/${key}`);
  }

  /**
   * Valida que los campos offline obligatorios estén completos.
   */
  public isProductorTabValid(): ValidationResult {
    const data = this._formData.getValue();
    const missing: string[] = [];

    if (!data.dni_productor || data.dni_productor.length !== 8) missing.push('DNI (8 dígitos)');
    if (!data.tipo_productor) missing.push('Tipo de productor');
    if (!data.celular_participante) missing.push('Número de celular');

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
    // BLOQUEO DE EDICIÓN
    if (this._formData.getValue().uploaded) {
      await this.showToast('Registro enviado. No se pueden agregar más fotos.', 'warning');
      return;
    }

    if (this._photosForDisplay.getValue().length >= 6) { // No hay errores aquí, pero es una buena práctica de validación.
      await this.showToast('Límite de 6 fotos alcanzado.', 'warning');
      return;
    }

    const permissions = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    if (permissions.camera !== 'granted' || permissions.photos !== 'granted') { // No hay errores aquí, pero es una buena práctica de validación.
      await this.showToast('Se necesitan permisos de cámara y galería.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Procesando foto...' });
    await loading.present();

    try {
      const currentFormData = this._formData.getValue();
      const productorDni = currentFormData.dni_productor;

      if (!productorDni || productorDni.length !== 8) {
        await this.showToast('Por favor, ingrese un DNI válido de 8 dígitos antes de tomar la foto.', 'warning', 'top');
        return; // CORRECCIÓN: Evita que se abra la cámara si el DNI es inválido
      }

      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera
      });
      if (!image.base64String) return;

      // MEJORA DE PRECISIÓN: maximumAge: 0 fuerza una lectura real del satélite ahora mismo.
      let position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

      // Si la precisión es pobre (>15m), re-intentamos una vez más para dar tiempo al sensor a estabilizarse
      if (position.coords.accuracy > 15) {
        position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      }

      const coords = position.coords;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        throw new Error('Coordenadas inválidas o nulas recibidas del GPS.');
      }

      const date = new Date();
      const altStr = (coords.altitude !== null && coords.altitude !== undefined)
        ? `Alt: ${coords.altitude.toFixed(2)} msnm`
        : 'Alt: No disponible';

      const textLines = [
        `Lat: ${coords.latitude.toFixed(5)} Lon: ${coords.longitude.toFixed(5)}`,
        altStr,
        `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
      ];

      const imageWithOverlayBase64 = await this.addTextOverlayToImage(`data:image/jpeg;base64,${image.base64String}`, textLines);
      const timestamp = new Date().getTime();
      const fileName = `parcela_${productorDni}_${timestamp}.jpeg`; // Nombrado informativo

      const savedFile = await Filesystem.writeFile({
        path: fileName, data: imageWithOverlayBase64, directory: Directory.Data
      });

      try {
        await Filesystem.writeFile({
          path: `GeoDAIS_Fotos/${fileName}`, data: imageWithOverlayBase64, directory: Directory.Documents, recursive: true
        });
        const alert = await this.alertController.create({
          header: '📸 Copia Guardada',
          subHeader: 'Carpeta: GeoDAIS_Fotos',
          message: 'Se exportó una copia con <b>marca de agua (GPS)</b> a sus documentos públicos.',
          buttons: [{ text: 'Entendido', role: 'cancel' }]
        });
        await alert.present();
      } catch (publicSaveError) {
        //console.warn(`[RegisterDataService] No se pudo guardar copia de la foto en la galería pública:`, publicSaveError);
      }

      const currentSavedUris = this._savedPhotoUris.getValue();
      this._savedPhotoUris.next([...currentSavedUris, savedFile.uri]);
      const currentDisplayPhotos = this._photosForDisplay.getValue();
      this._photosForDisplay.next([...currentDisplayPhotos, Capacitor.convertFileSrc(savedFile.uri)]);

      await this.autoSaveState(); // Persistencia inmediata

    } catch (error: any) {
      const rawErrorMessage = error.message || JSON.stringify(error);

      let displayMessage = `Error: ${rawErrorMessage}`; // Mensaje por defecto
      if (rawErrorMessage.toLowerCase().includes('could not obtain location in time')) {
        displayMessage = 'No se pudo obtener la ubicación GPS a tiempo. Intente en un lugar con mejor señal.';
      }

      await this.showToast(displayMessage, 'danger', 'middle', 5000);
    } finally {
      await loading.dismiss();
    }
  }

  public async deletePhoto(index: number) {
    // BLOQUEO DE EDICIÓN
    if (this._formData.getValue().uploaded) {
      await this.showToast('Registro enviado. No se pueden eliminar fotos.', 'warning');
      return;
    }

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
              console.warn(`[RegisterDataService] No se pudo eliminar el archivo de foto ${uriToDelete}:`, e);
            }
            uris.splice(index, 1);
            displayPhotos.splice(index, 1);
            this._savedPhotoUris.next(uris);
            this._photosForDisplay.next(displayPhotos);
            await this.autoSaveState();
          }

        }
      ]
    });
    await alert.present();
  }

  public async takeDniPicture(side: 'front' | 'back') {
    // BLOQUEO DE EDICIÓN
    if (this._formData.getValue().uploaded) {
      await this.showToast('Registro enviado. No se pueden cambiar las fotos del DNI.', 'warning');
      return;
    }

    const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
    if (permissions.camera !== 'granted') {
      await this.showToast('Se necesita permiso de cámara.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Procesando foto...' });
    await loading.present();

    try {
      const currentFormData = this._formData.getValue();
      const productorDni = currentFormData.dni_productor;
      const recordKey = this._editKey.getValue();

      if (!productorDni || productorDni.length !== 8) {
        await this.showToast('Por favor, ingrese un DNI válido de 8 dígitos antes de tomar la foto.', 'warning', 'top');
        return;
      }

      if (!recordKey) {
        await this.showToast('Error: No se pudo identificar el registro actual. Intente de nuevo.', 'danger', 'middle');
        return;
      }


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

      const timestamp = new Date().getTime();
      const fileName = `dni_${side}_${productorDni}_${recordKey}_${timestamp}.jpeg`;

      // Si ya existe una foto para este lado, la eliminamos primero
      const existingUri = side === 'front' ? currentFormData.ruta_dni_front : currentFormData.ruta_dni_back;
      if (existingUri) {
        try {
          // El URI guardado ya es la ruta completa, no necesitamos especificar el directorio
          await Filesystem.deleteFile({ path: existingUri });
        } catch (e) {
          console.warn(`[RegisterDataService] No se pudo eliminar el archivo de foto de DNI ${existingUri}:`, e);
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
          path: `GeoDAIS_DNI/${fileName}`,
          data: fileData.data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (publicSaveError) {
        console.warn('[RegisterDataService] Error al guardar copia de DNI en documentos:', publicSaveError);
      }

      if (side === 'front') {
        currentFormData.ruta_dni_front = savedFile.uri; // Referencia interna para Filesystem
      } else {
        currentFormData.ruta_dni_back = savedFile.uri;
      }
      this._formData.next(currentFormData);
      await this.autoSaveState(); // Persistencia inmediata

    } catch (error: any) {
      const errorMessage = error.message || JSON.stringify(error);
      if (errorMessage.toLowerCase().includes('user cancelled')) {
        return; // No mostrar error si el usuario cancela
      }
      await this.showToast(`Error: ${errorMessage}`, 'danger', 'middle', 5000);
    } finally {
      await loading.dismiss();
    }
  }

  public async deleteDniPicture(side: 'front' | 'back') {
    // BLOQUEO DE EDICIÓN
    if (this._formData.getValue().uploaded) {
      await this.showToast('Registro enviado. No se pueden eliminar las fotos del DNI.', 'warning');
      return;
    }

    const currentFormData = this._formData.getValue();
    const uriToDelete = side === 'front' ? currentFormData.ruta_dni_front : currentFormData.ruta_dni_back;

    if (uriToDelete) {
      try {
        // El URI guardado ya es la ruta completa, no necesitamos especificar el directorio
        await Filesystem.deleteFile({ path: uriToDelete });
      } catch (e) {
        console.warn(`[RegisterDataService] No se pudo eliminar el archivo de foto de DNI ${uriToDelete}:`, e);
      }

      if (side === 'front') {
        currentFormData.ruta_dni_front = '';
      } else {
        currentFormData.ruta_dni_back = '';
      }
      this._formData.next(currentFormData);
      await this.autoSaveState();
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
    // MEJORA: Clonar el estado para evitar mutaciones directas y comportamientos inesperados.
    const data = { ...this._formData.getValue() };

    if (geometryType === 'Point') {
      data.geometryTypeLabel = 'Punto';
      const coords = geojson.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      data.longitud = coords[0];
      data.latitud = coords[1];
      data.centroide = `Lat: ${coords[1].toFixed(5)}, Lon: ${coords[0].toFixed(5)}`;

      let altVal = (coords.length > 2 && coords[2] !== undefined) ? Number(coords[2]) : NaN;
      // Fallback al GPS si la coordenada Z no existe en el GeoJSON
      if (isNaN(altVal)) {
        const gps = this.gpsDataService.getGpsValue();
        if (gps && gps.alt !== null) altVal = gps.alt;
      }

      data.altitud = !isNaN(altVal) ? `${altVal.toFixed(2)} msnm` : 'No disponible';
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
      data.latitud = center.lat;
      data.longitud = center.lng;
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      data.altitud = this.calculateAverageAltitude(coords);
    // MEJORA: Ser explícito con los tipos de geometría para evitar errores con tipos no manejados.
    } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
      data.geometryTypeLabel = 'Polígono';

      // CORRECCIÓN: Acceder de forma segura a las coordenadas para evitar errores con MultiPolygon vacíos.
      let coords;
      if (geometryType === 'Polygon') {
        coords = geojson.geometry.coordinates[0];
      } else { // MultiPolygon
        if (geojson.geometry.coordinates && geojson.geometry.coordinates.length > 0) {
          coords = geojson.geometry.coordinates[0][0];
        }
      }

      if (!coords || coords.length < 3) return;
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));

      // CORRECCIÓN: Asegurarse de que el polígono esté cerrado para el cálculo del área, evitando resultados incorrectos.
      const closedLatlngs = [...latlngs];
      if (closedLatlngs.length > 0 && closedLatlngs[0].distanceTo(closedLatlngs[closedLatlngs.length - 1]) > 1) {
        closedLatlngs.push(closedLatlngs[0]);
      }
      const areaM2 = L.GeometryUtil.geodesicArea(closedLatlngs);
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
      data.latitud = center.lat;
      data.longitud = center.lng;
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      data.altitud = this.calculateAverageAltitude(coords);
    }

    // MEJORA: Incluir la altitud en la cadena del centroide para persistencia en la BD
    if (data.altitud && data.altitud !== 'No disponible') {
      data.centroide += `, Alt: ${data.altitud}`;
    }

    this._formData.next(data);
    // Iniciar autocompletado de ubigeo después de calcular los datos geométricos
    this.autocompletarUbicacion(geojson.geometry);
  }

  private calculateAverageAltitude(coords: any[]): string {
    if (!coords || !Array.isArray(coords)) {
      return this.getGpsFallback();
    }

    const validAltitudes = coords
      .map(c => (c.length > 2 && c[2] !== undefined ? Number(c[2]) : NaN))
      .filter(alt => !isNaN(alt));

    if (validAltitudes.length > 0) {
      const sum = validAltitudes.reduce((acc, val) => acc + val, 0);
      const avg = sum / validAltitudes.length;
      return `${avg.toFixed(2)} msnm`;
    }

    return this.getGpsFallback();
  }

  private getGpsFallback(): string {
    // Solo usamos el GPS actual como fallback si el registro es nuevo o es un borrador (proceso de captura activo)
    const isNewOrDraft = !this._editKey.getValue() || this._geojson.getValue()?.properties?.status === 'draft';

    if (isNewOrDraft) {
      const gps = this.gpsDataService.getGpsValue();
      if (gps && gps.alt !== null) {
        return `${gps.alt.toFixed(2)} msnm`;
      }
    }
    return 'No disponible';
  }

  public async autocompletarUbicacion(geometry: any, ignoreExisting: boolean = false, targetData?: Partial<GeoJsonProperties>): Promise<Partial<GeoJsonProperties> | null> {
    if (!geometry) return null;

    // Si no se pasa targetData, usamos el estado actual del formulario (UI)
    const currentData = targetData ? targetData : this._formData.getValue();
    if (!ignoreExisting && currentData.ubigeo_inei?.trim()) {
        return null;
    }

    let point: { x: number, y: number };

    // Determinar el punto a consultar (centroide para líneas y polígonos)
    if (geometry.type === 'Point') {
      point = { x: geometry.coordinates[0], y: geometry.coordinates[1] };
    } else {
      let latlngs: L.LatLng[];
      if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
        const coords = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates[0];
        // CORRECCIÓN: Una línea necesita al menos 2 puntos para tener un centro.
        if (!coords || coords.length < 2) return null;
        latlngs = coords.map((c: any) => L.latLng(c[1], c[0]));
        const center = L.polyline(latlngs).getBounds().getCenter();
        point = { x: center.lng, y: center.lat };
      } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        // CORRECCIÓN: Acceder de forma segura a las coordenadas para evitar errores.
        let coords;
        if (geometry.type === 'Polygon') {
          coords = geometry.coordinates[0];
        } else { // MultiPolygon
          if (geometry.coordinates && geometry.coordinates.length > 0) {
            coords = geometry.coordinates[0][0];
          }
        }
        // CORRECCIÓN: Un polígono necesita al menos 3 puntos para tener un centro.
        if (!coords || coords.length < 3) return null;
        latlngs = coords.map((c: any) => L.latLng(c[1], c[0]));
        const center = L.polygon(latlngs).getBounds().getCenter();
        point = { x: center.lng, y: center.lat };
      } else {
        return null;
      }
    }

    // --- Query for Distrito/Provincia/Departamento ---
    const ubigeoQueryParams = new URLSearchParams({
      geometry: JSON.stringify({ x: point.x, y: point.y }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      // Usamos * para evitar fallos si los nombres de campos cambian entre servicios
      outFields: '*',
      returnGeometry: 'false',
      f: 'json'
    });
    const ubigeoUrl = `https://services8.arcgis.com/tPY1NaqA2ETpJ86A/ArcGIS/rest/services/caribgeoportal/FeatureServer/6/query?${ubigeoQueryParams.toString()}`;

    // --- Query for Oficina Zonal ---
    const zonalQueryParams = new URLSearchParams({
      geometry: JSON.stringify({ x: point.x, y: point.y }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'nombre',
      returnGeometry: 'false',
      f: 'json'
    });
    const zonalUrl = `https://services8.arcgis.com/tPY1NaqA2ETpJ86A/ArcGIS/rest/services/caribgeoportal/FeatureServer/0/query?${zonalQueryParams.toString()}`;

    try {
      const [ubigeoResponse, zonalResponse] = await Promise.all([
        CapacitorHttp.get({ url: ubigeoUrl }),
        CapacitorHttp.get({ url: zonalUrl })
      ]);

      // Clonamos los datos para trabajar de forma inmutable
      const workingData = targetData ? { ...targetData } : { ...this._formData.getValue() };
      let ubigeoDataFound = false;

      let ubigeoData = ubigeoResponse.data;
      if (typeof ubigeoData === 'string') {
        try { ubigeoData = JSON.parse(ubigeoData); } catch (e) { console.error('Error parseando ubigeoData:', e); }
      }

      if (ubigeoResponse.status === 200 && ubigeoData?.features?.length > 0) {
        const attr = ubigeoData.features[0].attributes;

        // Buscador de atributos robusto (ignora mayúsculas/minúsculas y prueba variantes comunes)
        const getAttr = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(attr).find(key => key.toUpperCase() === k.toUpperCase());
            if (foundKey && attr[foundKey]) return attr[foundKey];
          }
          return '';
        };

        // ASIGNACIÓN CORRECTA: Nombres van a los campos _inei (150 chars)
        // ASIGNACIÓN DE NOMBRES (para los campos _inei con 150 caracteres)
        // Priorizamos campos de texto para evitar capturar el código por accidente
        workingData.departamento_inei = String(getAttr(['NOMBDEP', 'DEPARTAMEN', 'NOM_DEPART']) || workingData.departamento_inei).toUpperCase();
        workingData.provincia_inei = String(getAttr(['NOMBPROV', 'PROVIN_1', 'NOM_PROV']) || workingData.provincia_inei).toUpperCase();
        workingData.distrito_inei = String(getAttr(['NOMBDIST', 'DISTRITO_1', 'NOM_DIST']) || workingData.distrito_inei).toUpperCase();

        // ASIGNACIÓN DE CÓDIGOS (para los campos UBIGEO_ con 10 caracteres)
        // Buscamos específicamente el código numérico (IDUBIGEO / UBIGEO)
        const deptCode = getAttr(['IDDEPARTAMENTO', 'CODDEP', 'UBIGEO_DEP']);
        const provCode = getAttr(['IDPROVINCIA', 'CODPROV', 'UBIGEO_PRO']);
        const distCode = getAttr(['IDUBIGEO', 'UBIGEO', 'CODDIST', 'COD_DIST', 'UBIGEO_REN']);

        if (deptCode) workingData.UBIGEO_DEPARTAMENTO = deptCode.toString().substring(0, 10);
        if (provCode) workingData.UBIGEO_PROVINCIA = provCode.toString().substring(0, 10);
        if (distCode) workingData.UBIGEO_DISTRITO = distCode.toString().substring(0, 10);
        if (distCode) workingData.ubigeo_inei = distCode.toString().substring(0, 6);

        ubigeoDataFound = true;
      }

      let zonalData = zonalResponse.data;
      if (typeof zonalData === 'string') {
        try { zonalData = JSON.parse(zonalData); } catch (e) { console.error('Error parseando zonalData:', e); }
      }

      if (zonalResponse.status === 200 && zonalData?.features?.length > 0) {
        const attributes = zonalData.features[0].attributes;
        // Se corrige el nombre de la propiedad a 'oz_zonal' y se normaliza a mayúsculas
        workingData.oz_zonal = String(attributes.nombre || attributes.NOMBRE || 'FUERA DE LA OFICINA ZONAL').toUpperCase();
      } else {
        workingData.oz_zonal = 'FUERA DE LA OFICINA ZONAL';
      }

      // Solo actualizamos el BehaviorSubject si NO se pasó un targetData (es decir, es el formulario activo)
      if (!targetData) {
        this.zone.run(() => this._formData.next(workingData));
      }

      // Solo mostrar toast si es la UI activa
      if (ubigeoDataFound && !targetData) {
        await this.showToast('Datos de ubicación autocompletados.', 'success');
      }

      return workingData;

    } catch (error: any) {
      await this.showToast(`No se pudo autocompletar la ubicación: ${error.message || 'Error de red'}`, 'warning');
      return null;
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

  /**
   * Muestra un toast (mensaje emergente) de forma centralizada.
   * @param message El mensaje a mostrar.
   * @param color El color del toast.
   * @param position La posición en la pantalla.
   * @param duration La duración en milisegundos.
   */
  public async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'tertiary' | 'primary' | 'medium' = 'tertiary',
    position: 'top' | 'bottom' | 'middle' = 'middle',
    duration: number = 3000,
    icon?: string
  ) {
    // Usa el icono proporcionado o selecciona uno automáticamente por color
    let iconName = icon || '';
    if (!iconName) {
      switch (color) {
        case 'success': iconName = 'checkmark-circle-outline'; break;
        case 'danger':  iconName = 'close-circle-outline'; break;
        case 'warning': iconName = 'warning-outline'; break;
        case 'primary': iconName = 'information-circle-outline'; break;
      }
    }

    const toast = await this.toastController.create({
      message,
      duration,
      position,
      color,
      icon: iconName || undefined,
      cssClass: 'multiline-toast' // Clase para permitir múltiples líneas
    });
    await toast.present();
  }

  // --- Notificaciones Locales ---

  /**
   * Verifica registros pendientes (verdes pero no enviados) y muestra una notificación local.
   */
  public async updatePendingUploadNotification() {
    try {
      const allRecords = await this.getAllRawRecords();
      // Contamos: Registros completos (verdes) Y que NO tengan 'uploaded: true'
      const pendingCount = allRecords.filter(rec =>
        this.isRecordComplete(rec.properties) && !rec.properties.uploaded
      ).length;

      const NOTIFICATION_ID = 1001;

      if (pendingCount > 0) {
        // Verificar permisos antes de programar
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'prompt') {
          perm = await LocalNotifications.requestPermissions();
        }
        if (perm.display !== 'granted') return;

        await LocalNotifications.schedule({
          notifications: [{
            title: 'Registros Pendientes - GeoDAIS',
            body: `Tienes ${pendingCount} registro(s) listos para enviar a DEVIDA. Toca para abrir.`,
            id: NOTIFICATION_ID,
            schedule: { at: new Date(Date.now() + 1000) }, // Mostrar 1 segundo después
            smallIcon: 'ic_stat_icon_config_sample', // Icono por defecto de Android o el de tu app
          }]
        });
      } else {
        // Si no hay pendientes, cancelamos la notificación para limpiar la barra de estado
        await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      }
    } catch (error) {
      console.warn('Error gestionando notificaciones locales (plugin no instalado o error):', error);
    }
  }
}
