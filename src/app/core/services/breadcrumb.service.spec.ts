import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { BreadcrumbService } from "./breadcrumb.service";
import { DESTINO_REGISTRADO } from "./navegacion.service";
import { DESTINO_HOY } from "@core/models/destino.model";

@Component({ standalone: true, template: "" })
class StubPage {}

describe("BreadcrumbService", () => {
  let service: BreadcrumbService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: "", component: StubPage },
          { path: "**", component: StubPage },
        ]),
        // El breadcrumb deriva del menú, y el menú de los destinos registrados.
        // Sin registrar ninguno, no hay contra qué comparar la URL.
        { provide: DESTINO_REGISTRADO, useValue: DESTINO_HOY, multi: true },
      ],
    });
    service = TestBed.inject(BreadcrumbService);
    router = TestBed.inject(Router);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("home should always have routerLink '/'", () => {
    expect(service.breadcrumb().home.routerLink).toBe("/");
  });

  it("home should have a label and an icon", () => {
    expect(service.breadcrumb().home.label).toBeTruthy();
    expect(service.breadcrumb().home.icon).toBeTruthy();
  });

  it("breadcrumb items should be empty on the root route '/'", async () => {
    await router.navigateByUrl("/");
    expect(service.breadcrumb().items.length).toBe(0);
  });

  it("breadcrumb items should contain the matched destino label", async () => {
    // Antes este test navegaba a /app/settings y esperaba "Configuración" — una
    // entrada de menú que nunca tuvo ruta. Verificaba el comportamiento de un
    // enlace muerto; ahora verifica el de un destino que existe de verdad.
    await router.navigateByUrl("/app/hoy");
    const items = service.breadcrumb().items;
    expect(items.length).toBe(1);
    expect(items[0].label).toBe("Hoy");
  });

  it("the active breadcrumb item should have no routerLink (current page)", async () => {
    await router.navigateByUrl("/app/hoy");
    const last = service.breadcrumb().items.at(-1);
    expect(last).toBeDefined();
    expect(last?.routerLink).toBeUndefined();
  });

  it("breadcrumb items should be empty for an unknown URL", async () => {
    await router.navigateByUrl("/unknown-route-xyz");
    expect(service.breadcrumb().items.length).toBe(0);
  });
});
