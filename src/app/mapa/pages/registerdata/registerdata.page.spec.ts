import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterdataPage } from './registerdata.page';

describe('RegisterdataPage', () => {
  let component: RegisterdataPage;
  let fixture: ComponentFixture<RegisterdataPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterdataPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
