import { inject, Injectable } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { Auth, getAuth, signInWithEmailAndPassword } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private afApp: FirebaseApp = inject(FirebaseApp);
  private auth: Auth = getAuth(this.afApp);

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);

   }

}