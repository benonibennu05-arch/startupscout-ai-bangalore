import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  whereWeWorkAdapter,
  WHEREWEWORK_CITIES,
  isInternshipTitle,
} from '../server/adapters/whereWeWork.adapter.ts';

describe('WhereWeWork Adapter Tests', () => {
  it('should support required Indian tech cities', () => {
    assert.ok(WHEREWEWORK_CITIES.includes('bengaluru'));
    assert.ok(WHEREWEWORK_CITIES.includes('hyderabad'));
    assert.ok(WHEREWEWORK_CITIES.includes('pune'));
    assert.ok(WHEREWEWORK_CITIES.includes('gurugram'));
    assert.ok(WHEREWEWORK_CITIES.includes('delhi'));
  });

  it('should accurately detect internship vs full-time titles', () => {
    assert.equal(isInternshipTitle('Software Engineering Intern'), true);
    assert.equal(isInternshipTitle('Frontend Development Internship'), true);
    assert.equal(isInternshipTitle('Graduate Trainee Engineer'), true);
    assert.equal(isInternshipTitle('Summer Fellow'), true);
    assert.equal(isInternshipTitle('Senior Backend Engineer'), false);
    assert.equal(isInternshipTitle('Staff Machine Learning Scientist'), false);
    assert.equal(isInternshipTitle('Product Manager'), false);
  });

  it('should have correct adapter configuration', () => {
    assert.equal(whereWeWorkAdapter.id, 'src_wherewework');
    assert.equal(whereWeWorkAdapter.name, 'WhereWeWork.co.in');
    assert.equal(whereWeWorkAdapter.sourceMap, 'WHEREWEWORK');
    assert.equal(whereWeWorkAdapter.baseUrl, 'https://wherewework.co.in');
  });

  it('should return health status for monitoring', () => {
    const status = whereWeWorkAdapter.getStatus();
    assert.ok(status);
    assert.equal(status.sourceMap, 'WHEREWEWORK');
    assert.equal(status.sourceUrl, 'https://wherewework.co.in');
  });
});
