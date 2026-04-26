import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tourists } from './tourists';

describe('Tourists', () => {
  let component: Tourists;
  let fixture: ComponentFixture<Tourists>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tourists]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tourists);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
