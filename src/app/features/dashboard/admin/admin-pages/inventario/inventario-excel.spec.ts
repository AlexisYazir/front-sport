import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { ProductService } from '../../../../../core/services/product.service';
import { Inventario } from './inventario';

describe('Inventario: compatibilidad de la librería de Excel', () => {
  let component: Inventario;
  let toastr: jasmine.SpyObj<ToastrService>;
  let saveMovements: jasmine.Spy;

  beforeEach(() => {
    toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error']);
    saveMovements = jasmine.createSpy('bulkCreateInventoryMovements');
    TestBed.configureTestingModule({ providers: [
      { provide: ProductService, useValue: { bulkCreateInventoryMovements: saveMovements } },
      { provide: ToastrService, useValue: toastr },
    ] });
    component = TestBed.runInInjectionContext(() => new Inventario());
  });

  async function preview(file: File): Promise<void> {
    await new Promise<void>(resolve => {
      toastr.success.and.callFake(() => { resolve(); return {} as never; });
      toastr.warning.and.callFake(() => { resolve(); return {} as never; });
      toastr.error.and.callFake(() => { resolve(); return {} as never; });
      component.previewExcelFile(file);
    });
  }

  it('lee un archivo XLSX real y conserva la validación de filas sin guardar movimientos', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['sku', 'tipo', 'cantidad', 'costo_unitario'],
      ['TENIS-001', 'entrada', 3, 125.5],
      ['ROPA-002', 'otro', -2, 0],
    ]), 'Movimientos');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    await preview(new File([bytes], 'movimientos.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    expect(toastr.error).not.toHaveBeenCalled();
    expect(component.importPreview?.totalRows).toBe(2);
    expect(component.importPreview?.validRows.length).toBe(1);
    expect(component.importPreview?.validRows[0]).toEqual(jasmine.objectContaining({
      sku: 'TENIS-001', tipo: 'entrada', cantidad: 3, costo_unitario: 125.5,
    }));
    expect(component.importPreview?.invalidRows.length).toBe(1);
    expect(saveMovements).not.toHaveBeenCalled();
  });

  it('sigue aceptando CSV en la vista previa de inventario', async () => {
    await preview(new File(['sku,tipo,cantidad\nBALON-001,salida,2\n'], 'movimientos.csv', { type: 'text/csv' }));
    expect(toastr.error).not.toHaveBeenCalled();
    expect(component.importPreview?.validRows[0]).toEqual(jasmine.objectContaining({
      sku: 'BALON-001', tipo: 'salida', cantidad: 2,
    }));
    expect(saveMovements).not.toHaveBeenCalled();
  });

  it('conserva textos con acentos y números al generar y volver a leer un reporte', () => {
    const rows = [{ Producto: 'Balón de fútbol', Cantidad: 2, Total: 499.5 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Reporte');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const restored = XLSX.read(bytes, { type: 'array' });
    expect(XLSX.utils.sheet_to_json(restored.Sheets['Reporte'])).toEqual(rows);
  });
});
