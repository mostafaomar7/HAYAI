import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Renewal } from './renewal';

describe('Renewal', () => {
  let component: Renewal;
  let fixture: ComponentFixture<Renewal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Renewal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Renewal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
