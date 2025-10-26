import { inject, Injectable } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Auth, getAuth, signInWithEmailAndPassword, UserCredential, signOut } from '@angular/fire/auth';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';

// Definimos una clave para guardar las credenciales de forma segura
const CREDENTIALS_KEY = 'userCredentials';

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
        // Guardamos las credenciales en el dispositivo después de un login exitoso
        const credentialsToStore = { email, password };
        await Preferences.set({ key: CREDENTIALS_KEY, value: JSON.stringify(credentialsToStore) });
        console.log('MODO ONLINE: Credenciales guardadas en el dispositivo.', credentialsToStore);
        return credential;
      } catch (error) {
        console.error('Error de inicio de sesión en línea:', error);
        // Si falla el login online, por si acaso, limpiamos credenciales viejas
        await Preferences.remove({ key: CREDENTIALS_KEY });
        console.log('MODO ONLINE: Credenciales locales eliminadas por fallo en login.');
        throw error; // Propagamos el error de Firebase
      }
    } else {
      // --- MODO OFFLINE ---
      console.log('MODO OFFLINE: Intentando iniciar sesión sin conexión.');
      const { value } = await Preferences.get({ key: CREDENTIALS_KEY });
      if (!value) {
        console.error('MODO OFFLINE: No se encontraron credenciales guardadas.');
        throw new Error('No hay credenciales guardadas. Necesitas iniciar sesión una vez con conexión a internet.');
      }

      const storedCredentials = JSON.parse(value);
      console.log('MODO OFFLINE: Comparando credenciales ingresadas con las guardadas:', { email, password }, storedCredentials);
      if (storedCredentials.email === email && storedCredentials.password === password) {
        console.log('Inicio de sesión sin conexión exitoso.');
        // Devolvemos un objeto especial para indicar que el login offline fue correcto
        return { offlineSuccess: true };
      } else {
        console.error('MODO OFFLINE: Las credenciales no coinciden.');
        throw new Error('Credenciales incorrectas para el modo sin conexión.');
      }
    }
  }

  async logout() {
    // Primero, eliminamos las credenciales locales para invalidar el login offline
    await Preferences.remove({ key: CREDENTIALS_KEY });
    console.log('LOGOUT: Credenciales locales eliminadas.');

    // Luego, cerramos la sesión de Firebase.
    // Esto no da error si se ejecuta sin conexión.
    return signOut(this.auth);
  }

}