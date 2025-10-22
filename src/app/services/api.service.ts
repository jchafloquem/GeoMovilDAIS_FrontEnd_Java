import { Injectable } from '@angular/core';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from '../../environments/environment';

// Define interfaces para las respuestas de la API de RENIEC
export interface ReniecResponse {
  first_name: string;
  first_last_name: string;
  second_last_name: string;
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

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // Considera mover este token a environment.ts para una mejor gestión y seguridad
  private reniecToken: string = 'sk_2622.FO9PZhk5V73qfhjWluim7DJ4gOCjG8al';

  constructor() { }

  async getReniecData(dni: string): Promise<ReniecResponse | null> {
    try {
      const url = `${environment.apiUrl}/reniec/dni?numero=${dni}`;
      console.log('ApiService: Consultando RENIEC:', url);
      const response: HttpResponse = await CapacitorHttp.get({
        url,
        headers: { Authorization: `Bearer ${this.reniecToken}` }
      });

      if (response.status === 200 && response.data && (response.data as ReniecResponse).first_name) {
        return response.data as ReniecResponse;
      } else {
        console.warn('ApiService: RENIEC no devolvió datos válidos o el estado no fue 200:', response);
        return null;
      }
    } catch (error: any) {
      console.error('ApiService: Error al consultar RENIEC:', error.message || error);
      throw new Error(`Error al consultar RENIEC: ${error.message || 'Error desconocido'}`); // Propagar el error para manejo en el componente
    }
  }

  async getMidagriData(dni: string): Promise<MidagriProductor | null> {
    try {
      const url = `https://gateway.midagri.gob.pe/sisppa/api/services/app/Consulta/GetDatosProductor?codDocumento=1&Documento=${dni}`;
      console.log('ApiService: Consultando MIDAGRI:', url);
      const response: HttpResponse = await CapacitorHttp.get({ url });
      const midagriData = response.data as MidagriApiResponse;

      if (response.status === 200 && midagriData && midagriData.success && midagriData.result) {
        if (Array.isArray(midagriData.result) && midagriData.result.length > 0) {
          return midagriData.result[0]; // Si es un array, toma el primer elemento
        } else if (!Array.isArray(midagriData.result) && typeof midagriData.result === 'object' && midagriData.result !== null) {
          return midagriData.result; // Si es un objeto, úsalo directamente
        }
      }
      console.warn('ApiService: MIDAGRI no devolvió datos válidos o el estado no fue 200/success:', response);
      return null;
    } catch (error: any) {
      console.error('ApiService: Error al consultar MIDAGRI:', error.message || error);
      throw new Error(`Error al consultar MIDAGRI: ${error.message || 'Error desconocido'}`); // Propagar el error
    }
  }
}
