import assert from 'node:assert/strict';

process.env.LINKEDIN_CLIENT_ID = 'client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'client-secret';
process.env.LINKEDIN_REDIRECT_URI = 'https://api.getaipilot.in/api/auth/linkedin/callback';

const { default: linkedinOAuth } = await import('../server/src/services/linkedinOAuth.js');

const url = new URL(linkedinOAuth.getAuthorizationUrl('state-token'));

assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
assert.equal(url.searchParams.has('enable_extended_login'), false);
assert.equal(url.searchParams.get('state'), 'state-token');
assert.equal(url.searchParams.get('redirect_uri'), process.env.LINKEDIN_REDIRECT_URI);

process.env.LINKEDIN_ENABLE_EXTENDED_LOGIN = 'true';
const extendedLoginUrl = new URL(linkedinOAuth.getAuthorizationUrl('state-token'));
assert.equal(extendedLoginUrl.searchParams.get('enable_extended_login'), 'true');
