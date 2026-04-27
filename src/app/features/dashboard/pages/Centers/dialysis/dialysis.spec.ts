import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dialysis } from './dialysis';

describe('Dialysis', () => {
  let component: Dialysis;
  let fixture: ComponentFixture<Dialysis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dialysis]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dialysis);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
