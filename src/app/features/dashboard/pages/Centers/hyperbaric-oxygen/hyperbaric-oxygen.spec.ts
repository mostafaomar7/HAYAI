import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HyperbaricOxygen } from './hyperbaric-oxygen';

describe('HyperbaricOxygen', () => {
  let component: HyperbaricOxygen;
  let fixture: ComponentFixture<HyperbaricOxygen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HyperbaricOxygen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HyperbaricOxygen);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
