import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notfication } from './notfication';

describe('Notfication', () => {
  let component: Notfication;
  let fixture: ComponentFixture<Notfication>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notfication]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Notfication);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
