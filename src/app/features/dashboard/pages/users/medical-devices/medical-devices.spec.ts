import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MedicalDevices } from './medical-devices';

describe('MedicalDevices', () => {
  let component: MedicalDevices;
  let fixture: ComponentFixture<MedicalDevices>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalDevices]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MedicalDevices);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
