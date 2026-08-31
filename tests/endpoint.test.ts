import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEndpoint } from '../server/deputy/endpoint.js';

test('le agrega https al host pelado que devuelve Deputy', () => {
  assert.equal(
    normalizeEndpoint('47924c10020044.au.deputy.com'),
    'https://47924c10020044.au.deputy.com',
  );
});

test('respeta el esquema si ya viene', () => {
  assert.equal(
    normalizeEndpoint('https://47924c10020044.au.deputy.com'),
    'https://47924c10020044.au.deputy.com',
  );
  assert.equal(normalizeEndpoint('http://localhost:8080'), 'http://localhost:8080');
});

test('saca barras finales y espacios', () => {
  assert.equal(normalizeEndpoint('  47924c10020044.au.deputy.com//  '), 'https://47924c10020044.au.deputy.com');
});

test('devuelve null si no hay nada util', () => {
  assert.equal(normalizeEndpoint(''), null);
  assert.equal(normalizeEndpoint('   '), null);
  assert.equal(normalizeEndpoint(null), null);
  assert.equal(normalizeEndpoint(undefined), null);
});
