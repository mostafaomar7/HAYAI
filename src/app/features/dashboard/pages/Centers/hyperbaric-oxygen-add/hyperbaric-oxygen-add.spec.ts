import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HyperbaricOxygenAdd } from './hyperbaric-oxygen-add';

describe('HyperbaricOxygenAdd', () => {
  let component: HyperbaricOxygenAdd;
  let fixture: ComponentFixture<HyperbaricOxygenAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HyperbaricOxygenAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HyperbaricOxygenAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
