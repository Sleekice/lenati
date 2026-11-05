import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiersUpTo } from '../src/tiers';

test('core readers see core only', () => assert.deepEqual(tiersUpTo('CORE'), ['CORE']));
test('campus readers see core and campus', () => assert.deepEqual(tiersUpTo('CAMPUS'), ['CORE', 'CAMPUS']));
test('clinical readers see everything', () => assert.deepEqual(tiersUpTo('CLINICAL'), ['CORE', 'CAMPUS', 'CLINICAL']));
