import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCard,
  IonCardContent,
  IonContent,
  IonButton,
  IonIcon,
  IonModal,
  IonList,
  IonListHeader,
  IonLabel,
  IonNote,
} from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { camera, close, closeCircle, imagesOutline, trashOutline, cameraOutline } from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { SwiperOptions } from 'swiper/types';

register();

@Component({
  selector: 'app-fotos-tab',
  templateUrl: './fotos-tab.page.html',
  styleUrls: ['./fotos-tab.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonButton,
    IonIcon,
    IonModal,
    IonCardTitle,
    IonCardSubtitle,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonList,
    IonListHeader,
    IonLabel,
    IonNote,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class FotosTabPage {
  isViewerOpen = false;

  viewerSlideOpts: SwiperOptions = {
    initialSlide: 0,
    slidesPerView: 1,
    centeredSlides: true,
    zoom: {
      maxRatio: 3,
      minRatio: 1,
    },
  };

  constructor(public registerDataService: RegisterDataService) {
    addIcons({trashOutline,cameraOutline,close,camera,closeCircle,imagesOutline});
  }

  deletePhoto(index: number, event: MouseEvent) {
    event.stopPropagation(); // Evita que se abra el visor de imágenes al hacer clic en el botón de eliminar.
    this.registerDataService.deletePhoto(index);
  }

  openViewer(index: number) {
    this.viewerSlideOpts.initialSlide = index;
    this.isViewerOpen = true;
  }

  closeViewer = () => {
    this.isViewerOpen = false;
  }
}
