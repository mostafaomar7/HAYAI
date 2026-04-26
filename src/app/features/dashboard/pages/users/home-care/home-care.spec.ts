import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeCare } from './home-care';

describe('HomeCare', () => {
  let component: HomeCare;
  let fixture: ComponentFixture<HomeCare>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeCare]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeCare);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
