import { Injectable } from '@angular/core';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from '../../environments/environment';

// Define interfaces para las respuestas de la API de RENIEC
export interface ReniecResponse {
  first_name: string;
  first_last_name: string;
  second_last_name: string;
  birthday?: string;
  sex?: string;
  // Agrega otros campos si son necesarios según la respuesta real de la API
}

// Define interfaces para los datos del productor de MIDAGRI
export interface MidagriProductor {
  txt_codigoautogenerado: string;
  fec_registro: string;
  txt_actagraria: string;
  num_superficie: string;
  txt_regtenencia: string;
  txt_sexo: string;
  txt_departamento: string;
  txt_provincia: string;
  txt_distrito: string;
  // Agrega otros campos si son necesarios según la respuesta real de la API
}

// Define la interfaz para la respuesta completa de la API de MIDAGRI
export interface MidagriApiResponse {
  result: MidagriProductor | MidagriProductor[] | null; // Puede ser un objeto o un array de objetos
  targetUrl: string | null;
  success: boolean;
  error: any | null;
  unAuthorizedRequest: boolean;
}

// --- ESTRUCTURA DE ENVÍO AL BACKEND ---
export interface ProductorRegistroPayload {
  internalKey: string;
  dniProductor?: string | null;
  nombreCompleto?: string | null;
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  fechaNacimiento?: string | null; // Formato YYYY-MM-DD
  celularParticipante?: string | null;
  tipoProductor?: string | null;
  sexoMidagri?: string | null; // char(1)
  // MIDAGRI
  codPpaMidagri?: string | null;
  fechaRegistroMidagri?: string | null;
  actividadAgrariaMidagri?: string | null;
  superficieMidagri?: number | string | null;
  regimenTenenciaMidagri?: string | null;
  departamentoMidagri?: string | null;
  provinciaMidagri?: string | null;
  distritoMidagri?: string | null;
  // GEOMETRIA
  tipoCultivo?: string | null;
  ozZonal?: string | null;
  ubigeoInei?: string | null;
  departamentoInei?: string | null;
  provinciaInei?: string | null;
  distritoInei?: string | null;
  caserio?: string | null;
  fuente?: string | null;
  datum?: string | null;
  perimetro?: number | null;
  area?: number | null;
  altitud?: number | null;
  latitud?: number | null;
  longitud?: number | null;
  observaciones?: string | null;
  // PROFESIONAL
  profesionalDni?: string | null;
  profesionalNombres?: string | null;
  profesionalApellidos?: string | null;
  profesionalCelular?: string | null;
  profesionalEmail?: string | null;
  deviceUuid?: string | null;
  geom: string | null;      // WKT GeometryZ
  centroide: string | null; // WKT Point 2D
  fotosAsociadas?: FotoRegistroPayload[];
}

export interface FotoRegistroPayload {
  tipoFoto: string;
  rutaFoto: string; // Base64
  internalKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // Considera mover este token a environment.ts para una mejor gestión y seguridad
  private reniecToken: string = 'sk_2622.FO9PZhk5V73qfhjWluim7DJ4gOCjG8al';

  constructor() { }

  async getReniecData(dni: string): Promise<ReniecResponse | null> {
    console.log(`[ApiService] Iniciando getReniecData para DNI: ${dni}`);
    try {
      // La URL del servicio de consulta de RENIEC es un endpoint externo y fijo.
      // Es independiente del 'apiUrl' de nuestro backend definido en los archivos de entorno.
      const url = `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`;
      console.log(`[ApiService] Consultando URL RENIEC: ${url}`);

      const response: HttpResponse = await CapacitorHttp.get({
        url,
        headers: { Authorization: `Bearer ${this.reniecToken}` }
      });

      console.log(`[ApiService] Respuesta de RENIEC recibida. Status: ${response.status}`);
      console.log('[ApiService] Datos de RENIEC:', JSON.stringify(response.data));

      if (response.status === 200 && response.data && (response.data as ReniecResponse).first_name) {
        console.log('[ApiService] RENIEC: Éxito, datos válidos encontrados.');
        return response.data as ReniecResponse;
      } else {
        console.warn('[ApiService] RENIEC: Respuesta no exitosa o datos inválidos.');
        return null;
      }
    } catch (error: any) {
      console.error(`[ApiService] Error crítico en getReniecData: ${error.message}`);
      console.error('[ApiService] Detalles del error RENIEC:', error);
      throw new Error(`Error al consultar RENIEC: ${error.message || 'Error desconocido'}`); // Propagar el error para manejo en el componente
    }
  }

  async getMidagriData(dni: string): Promise<MidagriProductor | null> {
    console.log(`[ApiService] Iniciando getMidagriData para DNI: ${dni}`);
    try {
      const url = `https://gateway.midagri.gob.pe/sisppa/api/services/app/Consulta/GetDatosProductor?codDocumento=1&Documento=${dni}`;
      console.log(`[ApiService] Consultando URL MIDAGRI: ${url}`);

      const response: HttpResponse = await CapacitorHttp.get({ url });
      const midagriData = response.data as MidagriApiResponse;

      console.log(`[ApiService] Respuesta de MIDAGRI recibida. Status: ${response.status}`);
      console.log('[ApiService] Datos de MIDAGRI:', JSON.stringify(midagriData));

      if (response.status === 200 && midagriData && midagriData.success && midagriData.result) {
        if (Array.isArray(midagriData.result) && midagriData.result.length > 0) {
          console.log('[ApiService] MIDAGRI: Éxito, se encontró un array de resultados. Usando el primero.');
          return midagriData.result[0]; // Si es un array, toma el primer elemento
        } else if (!Array.isArray(midagriData.result) && typeof midagriData.result === 'object' && midagriData.result !== null) {
          console.log('[ApiService] MIDAGRI: Éxito, se encontró un objeto de resultado.');
          return midagriData.result; // Si es un objeto, úsalo directamente
        }
      }
      console.warn('[ApiService] MIDAGRI: Respuesta no exitosa o sin resultados válidos.');
      return null;
    } catch (error: any) {
      console.error(`[ApiService] Error crítico en getMidagriData: ${error.message}`);
      console.error('[ApiService] Detalles del error MIDAGRI:', error);
      throw new Error(`Error al consultar MIDAGRI: ${error.message || 'Error desconocido'}`); // Propagar el error
    }
  }

  /**
   * Envía un lote de registros pre-procesados al backend.
   * @param payloads Un array de objetos de datos listos para ser enviados. Cada objeto debe tener la geometría en formato WKT.
   */
  async enviarRegistros(payloads: ProductorRegistroPayload[]): Promise<HttpResponse> {
    const url = `${environment.apiUrl}/registros`;
    console.log(`[ApiService] Iniciando enviarRegistros a URL: ${url} con ${payloads.length} registros.`);

    // La sanitización ahora se hace para cada payload en el array.
    const sanitizedPayloads = payloads.map(p => {
      const sanitizedPayload = { ...p };
      const superficieStr = sanitizedPayload.superficieMidagri;

      if (superficieStr && typeof superficieStr === 'string') {
        const superficieNum = parseFloat(superficieStr);
        sanitizedPayload.superficieMidagri = isNaN(superficieNum) ? null : superficieNum;
      } else if (typeof sanitizedPayload.superficieMidagri !== 'number') {
        sanitizedPayload.superficieMidagri = null;
      }
      return sanitizedPayload;
    });

    console.log('[ApiService] Payloads sanitizados para envío en lote:', JSON.stringify(sanitizedPayloads));

    try {
      const response = await CapacitorHttp.post({
        url,
        data: sanitizedPayloads,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`[ApiService] Respuesta de enviarRegistros recibida. Status: ${response.status}`);
      console.log('[ApiService] Datos de respuesta (lote):', JSON.stringify(response.data));
      return response;
    } catch (error: any) {
      console.error(`[ApiService] Error crítico en enviarRegistros: ${error.message}`);
      console.error('[ApiService] Detalles del error (lote):', error);
      throw error; // Re-lanzar el error para que el llamador lo maneje
    }
  }

  /**
   * Envía un único registro pre-procesado al backend.
   * Este método espera que el payload ya esté construido y que la geometría (si existe)
   * esté en el formato que espera el backend (ej. WKT).
   * @param payload El objeto de datos listo para ser enviado como JSON.
   */
  async enviarRegistroIndividual(payload: ProductorRegistroPayload): Promise<HttpResponse> {
    // CORRECCIÓN: Apuntamos al endpoint correcto y enviamos un objeto simple, como espera el backend.
    const url = `${environment.apiUrl}/registros/single`;
    console.log(`[ApiService] Iniciando enviarRegistroIndividual a URL: ${url}`);
    console.log('[ApiService] Payload original recibido:', JSON.stringify(payload));

    // Clonamos el payload para poder sanitizarlo sin modificar el objeto original.
    const sanitizedPayload = { ...payload };

    // --- INICIO: SANITIZADOR DE DATOS ---
    // El backend espera un NÚMERO para 'superficie_midagri'. Aquí nos aseguramos
    // de convertir el valor o enviarlo como null si no es un número válido.
    const superficieStr = sanitizedPayload.superficieMidagri;
    if (superficieStr && typeof superficieStr === 'string') {
      console.log(`[ApiService] Sanitizando superficie_midagri. Valor original: "${superficieStr}"`);
      const superficieNum = parseFloat(superficieStr);
      // Si la conversión resulta en un número válido, lo usamos.
      // Si no (ej. "NO REGISTRA" se convierte en NaN), enviamos null.
      sanitizedPayload.superficieMidagri = isNaN(superficieNum) ? null : superficieNum;
      console.log(`[ApiService] superficie_midagri sanitizado a: ${sanitizedPayload.superficieMidagri}`);
    } else if (typeof sanitizedPayload.superficieMidagri !== 'number') {
      console.log(`[ApiService] superficie_midagri no es string ni número. Forzando a null. Valor original:`, sanitizedPayload.superficieMidagri);
      // Si no es un string ni un número (ej. es '', undefined), lo forzamos a null.
      sanitizedPayload.superficieMidagri = null;
    }
    // --- FIN: SANITIZADOR DE DATOS ---

    console.log('[ApiService] Payload sanitizado para envío individual:', JSON.stringify(sanitizedPayload));

    try {
      const response = await CapacitorHttp.post({
        url,
        data: sanitizedPayload,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`[ApiService] Respuesta de enviarRegistroIndividual recibida. Status: ${response.status}`);
      if (response.status !== 200) console.error('[ApiService] Error del servidor:', JSON.stringify(response.data));
      return response;
    } catch (error: any) {
      console.error(`[ApiService] Error crítico en enviarRegistroIndividual: ${error.message}`);
      console.error('[ApiService] Detalles del error (individual):', error);
      throw error; // Re-lanzar el error para que el llamador lo maneje
    }
  }
}