import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Charitable } from './charitable';

describe('Charitable', () => {
  let component: Charitable;
  let fixture: ComponentFixture<Charitable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Charitable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Charitable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
