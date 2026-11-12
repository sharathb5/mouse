import { describe, expect, it } from 'vitest';
import type { ActionResult } from '@/core/contracts';
import {
  GoogleSheetsExporter,
  SheetsNotConfiguredError,
  UnconfiguredSheetsExporter,
  createGoogleSheetsApi,
  tableToSheetValues,
} from './sheets';

const table: Extract<ActionResult, { kind: 'table' }> = {
  kind: 'table',
  columns: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'currency' },
  ],
  rows: [
    { name: 'Lamp', price: 79 },
    { name: 'Stand', price: 129 },
  ],
  sources: ['http://127.0.0.1:4321/products.html'],
};

describe('SheetsExporter', () => {
  it('UnconfiguredSheetsExporter refuses export honestly', async () => {
    const exporter = new UnconfiguredSheetsExporter();
    const status = await exporter.status();
    expect(status.configured).toBe(false);
    await expect(exporter.export(table)).rejects.toBeInstanceOf(SheetsNotConfiguredError);
  });

  it('tableToSheetValues includes headers and string cells', () => {
    expect(tableToSheetValues(table)).toEqual([
      ['Name', 'Price'],
      ['Lamp', '79'],
      ['Stand', '129'],
    ]);
  });

  it('GoogleSheetsExporter creates a spreadsheet when a token is available (MOCKED fetch)', async () => {
    // MOCKED: fake Sheets API responses — not a live Google call.
    const fetchImpl: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/v4/spreadsheets') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              spreadsheetId: 'sheet-1',
              spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/values/')) {
        return Promise.resolve(new Response(JSON.stringify({ updatedCells: 6 }), { status: 200 }));
      }
      return Promise.resolve(new Response('not found', { status: 404 }));
    };

    const exporter = new GoogleSheetsExporter({
      getAccessToken: () => Promise.resolve('ya29.mock-token'),
      api: createGoogleSheetsApi(fetchImpl),
      titleFor: () => 'Test extract',
    });

    expect(await exporter.status()).toEqual({ configured: true });
    const result = await exporter.export(table);
    expect(result.url).toBe('https://docs.google.com/spreadsheets/d/sheet-1');
  });

  it('GoogleSheetsExporter stays unconfigured without a token', async () => {
    const exporter = new GoogleSheetsExporter({
      getAccessToken: () => Promise.resolve(null),
      api: createGoogleSheetsApi(() => Promise.resolve(new Response('no', { status: 500 }))),
    });
    expect(await exporter.status()).toMatchObject({ configured: false });
    await expect(exporter.export(table)).rejects.toBeInstanceOf(SheetsNotConfiguredError);
  });
});
