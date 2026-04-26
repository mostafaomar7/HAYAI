import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhysicalTherapy } from './physical-therapy';

describe('PhysicalTherapy', () => {
  let component: PhysicalTherapy;
  let fixture: ComponentFixture<PhysicalTherapy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhysicalTherapy]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PhysicalTherapy);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
