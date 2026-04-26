import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Clinics } from './clinics';

describe('Clinics', () => {
  let component: Clinics;
  let fixture: ComponentFixture<Clinics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Clinics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Clinics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
