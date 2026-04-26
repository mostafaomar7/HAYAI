import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MedicalIssuance } from './medical-issuance';

describe('MedicalIssuance', () => {
  let component: MedicalIssuance;
  let fixture: ComponentFixture<MedicalIssuance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalIssuance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MedicalIssuance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
