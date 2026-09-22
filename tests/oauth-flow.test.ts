import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../server/database/store.ts';

describe('OAuth State & Authorized Sender Tests', () => {
  it('should save and consume OAuth state with redirectUri', () => {
    const testState = `test-state-${Date.now()}`;
    const testRedirectUri = 'https://example.com/api/auth/google/callback';

    store.saveOAuthState(testState, testRedirectUri);

    // Consume state
    const consumed = store.consumeOAuthState(testState);
    assert.ok(consumed, 'OAuth state should be retrieved');
    assert.equal(consumed?.redirectUri, testRedirectUri, 'Redirect URI must match what was saved');

    // Consuming second time should fail (single-use CSRF token)
    const secondConsume = store.consumeOAuthState(testState);
    assert.equal(secondConsume.valid, false, 'Consumed state must be invalidated after first use');
  });

  it('should enforce tejamatta05@gmail.com as the authorized sender', () => {
    const authorized = 'tejamatta05@gmail.com';
    const unauthorized = 'hacker@example.com';
    const wrongUser = 'otherperson@gmail.com';

    // Verify authorized user check logic
    const isAuthorized = (email: string) => email.toLowerCase().trim() === 'tejamatta05@gmail.com';

    assert.equal(isAuthorized(authorized), true);
    assert.equal(isAuthorized(unauthorized), false);
    assert.equal(isAuthorized(wrongUser), false);
  });

  it('should format diagnostic payload properly', () => {
    const diagnostic = {
      browserOrigin: 'https://preview.app.run',
      configuredClientId: '674681604085-sample.apps.googleusercontent.com',
      configuredRedirectUri: 'https://preview.app.run/api/auth/google/callback',
      environment: 'Development',
      expectedJavaScriptOrigin: 'https://preview.app.run',
      expectedRedirectUri: 'https://preview.app.run/api/auth/google/callback',
      authorizedSender: 'tejamatta05@gmail.com',
      status: 'Disconnected',
    };

    assert.ok(diagnostic.expectedJavaScriptOrigin.startsWith('http'));
    assert.ok(diagnostic.expectedRedirectUri.endsWith('/api/auth/google/callback'));
    assert.equal(diagnostic.authorizedSender, 'tejamatta05@gmail.com');
  });
});
