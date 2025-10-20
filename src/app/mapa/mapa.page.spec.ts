import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapaPage } from './mapa.page';

describe('MapaPage', () => {
  let component: MapaPage;
  let fixture: ComponentFixture<MapaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MapaPage);
    component = fixture.componentInstance;

    // Evitamos que initMap se ejecute en el entorno de prueba, ya que no hay un DOM real
    // para que Leaflet se renderice y esto causa el error "Map container not found".
    spyOn(component as any, 'initMap');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
