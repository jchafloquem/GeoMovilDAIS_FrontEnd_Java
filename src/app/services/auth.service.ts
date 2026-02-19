import { inject, Injectable } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Auth, getAuth, signInWithEmailAndPassword, UserCredential, signOut } from '@angular/fire/auth';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';

// Definimos una clave para guardar las credenciales de forma segura
const CREDENTIALS_KEY = 'userCredentials';
const LAST_EMAIL_KEY = 'lastEmail';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private afApp: FirebaseApp = inject(FirebaseApp);
  private auth: Auth = getAuth(this.afApp);

  async login(email: string, password: string): Promise<UserCredential | { offlineSuccess: true }> {
    const status = await Network.getStatus();

    if (status.connected) {
      // --- MODO ONLINE ---
      try {
        const credential = await signInWithEmailAndPassword(this.auth, email, password);
        // Determinamos el rol del usuario basado en el email
        let role: 'default' | 'polygon-only' | 'other-crops' | 'point-polygon' = 'default';
        const lowerCaseEmail = email.toLowerCase();
        if (lowerCaseEmail === 'pirdais@devida.gob.pe') {
          role = 'polygon-only';
        } else if (lowerCaseEmail === 'cultivos@devida.gob.pe') {
          role = 'other-crops';
        } else if (lowerCaseEmail === 'acuavicola@devida.gob.pe') {
          role = 'point-polygon';
        }
        // Guardamos las credenciales y el rol en el dispositivo después de un login exitoso
        const credentialsToStore = { email, password, role };
        await Preferences.set({ key: CREDENTIALS_KEY, value: JSON.stringify(credentialsToStore) });
        await Preferences.set({ key: LAST_EMAIL_KEY, value: email });
        return credential;
      } catch (error: any) {
        // Si falla el login online, por si acaso, limpiamos credenciales viejas
        await Preferences.remove({ key: CREDENTIALS_KEY });
        // Personalizamos el mensaje de error para credenciales inválidas
        if (error.code === 'auth/invalid-credential') {
          throw new Error('El correo o la contraseña son incorrectos. Por favor, verifica tus datos.');
        }
        // Para cualquier otro error, lanzamos un mensaje más genérico
        throw new Error('Ocurrió un error al intentar iniciar sesión. Revisa tu conexión a internet.');
      }
    } else {
      // --- MODO OFFLINE ---
      const { value } = await Preferences.get({ key: CREDENTIALS_KEY });
      if (!value) {
        throw new Error('No hay credenciales guardadas. Necesitas iniciar sesión una vez con conexión a internet.');
      }

      const storedCredentials = JSON.parse(value);
      if (storedCredentials.email === email && storedCredentials.password === password) {
        await Preferences.set({ key: LAST_EMAIL_KEY, value: email });
        return { offlineSuccess: true };
      } else {
        throw new Error('El correo o la contraseña son incorrectos. Por favor, verifica tus datos.');
      }
    }
  }

  async logout() {
    // Primero, eliminamos las credenciales locales para invalidar el login offline
    await Preferences.remove({ key: CREDENTIALS_KEY });

    // Luego, cerramos la sesión de Firebase.
    // Esto no da error si se ejecuta sin conexión.
    return signOut(this.auth);
  }

  async getUserRole(): Promise<'default' | 'polygon-only' | 'other-crops' | 'point-polygon'> {
    const { value } = await Preferences.get({ key: CREDENTIALS_KEY });
    if (value) {
      const storedCredentials = JSON.parse(value);
      // Si el rol está guardado, lo retornamos, si no, 'default'
      return storedCredentials.role || 'default';
    }
    // Si no hay credenciales, el rol es 'default'
    return 'default';
  }

  async getLastEmail(): Promise<string> {
    const { value } = await Preferences.get({ key: LAST_EMAIL_KEY });
    return value || '';
  }

}
