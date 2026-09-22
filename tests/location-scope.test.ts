import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesLocationScope } from '../server/database/store.ts';
import { Company } from '../server/types.ts';

describe('Location Scope & Matching Tests', () => {
  it('should match Hyderabad startups by location string', () => {
    assert.equal(matchesLocationScope('Hyderabad, Telangana, India', 'HYDERABAD'), true);
    assert.equal(matchesLocationScope('Hitec City, Hyderabad', 'HYDERABAD'), true);
    assert.equal(matchesLocationScope('Gachibowli, Financial District', 'HYDERABAD'), true);
    assert.equal(matchesLocationScope('Madhapur, Hyderabad', 'HYDERABAD'), true);
    assert.equal(matchesLocationScope('Kondapur, Telangana', 'HYDERABAD'), true);
  });

  it('should match Bangalore startups by location string', () => {
    assert.equal(matchesLocationScope('Bangalore, Karnataka, India', 'BANGALORE'), true);
    assert.equal(matchesLocationScope('Bengaluru, India', 'BANGALORE'), true);
    assert.equal(matchesLocationScope('Koramangala, Bangalore', 'BANGALORE'), true);
    assert.equal(matchesLocationScope('Indiranagar, Bengaluru', 'BANGALORE'), true);
    assert.equal(matchesLocationScope('HSR Layout, Bengaluru', 'BANGALORE'), true);
  });

  it('should match based on company metadata even if location string is generic', () => {
    const hydCompany: Partial<Company> = {
      id: 'hyd-1',
      name: 'Darwinbox',
      location: 'India',
      sourceMap: 'HYDERABAD',
      locations: ['Hitec City, Hyderabad'],
    };

    assert.equal(matchesLocationScope(hydCompany.location, 'HYDERABAD', hydCompany as Company), true);
    assert.equal(matchesLocationScope(hydCompany.location, 'BANGALORE', hydCompany as Company), false);
  });

  it('should match WhereWeWork company sources correctly', () => {
    const wwwCompany: Partial<Company> = {
      id: 'www-1',
      name: 'Razorpay',
      location: 'Bangalore, India',
      sourceMap: 'WHEREWEWORK',
      sources: [
        {
          sourceMap: 'WHEREWEWORK',
          externalId: 'razorpay',
          sourceUrl: 'https://wherewework.co.in/companies/razorpay',
          discoveredAt: new Date().toISOString(),
        },
      ],
    };

    assert.equal(matchesLocationScope(wwwCompany.location, 'WHEREWEWORK', wwwCompany as Company), true);
    assert.equal(matchesLocationScope(wwwCompany.location, 'ALL', wwwCompany as Company), true);
  });

  it('should return true for ALL or BOTH scope', () => {
    assert.equal(matchesLocationScope('Hyderabad', 'ALL'), true);
    assert.equal(matchesLocationScope('Bangalore', 'BOTH'), true);
    assert.equal(matchesLocationScope('Remote', 'ALL'), true);
  });
});
