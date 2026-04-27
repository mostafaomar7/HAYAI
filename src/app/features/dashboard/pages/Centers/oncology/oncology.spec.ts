import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Oncology } from './oncology';

describe('Oncology', () => {
  let component: Oncology;
  let fixture: ComponentFixture<Oncology>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Oncology]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Oncology);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
