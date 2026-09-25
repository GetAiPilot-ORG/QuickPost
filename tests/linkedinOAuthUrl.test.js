import { describe, expect, it } from 'vitest';

process.env.LINKEDIN_CLIENT_ID = 'client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'client-secret';
process.env.LINKEDIN_REDIRECT_URI = 'https://api.getaipilot.in/api/auth/linkedin/callback';

const { default: linkedinOAuth } = await import('../server/src/services/linkedinOAuth.js');

describe('LinkedIn OAuth authorization URL', () => {
  it('builds standard authorization URL with required params', () => {
    delete process.env.LINKEDIN_ENABLE_EXTENDED_LOGIN;
    const url = new URL(linkedinOAuth.getAuthorizationUrl('state-token'));

    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.has('enable_extended_login')).toBe(false);
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('redirect_uri')).toBe(process.env.LINKEDIN_REDIRECT_URI);
  });

  it('includes enable_extended_login when env is set', () => {
    process.env.LINKEDIN_ENABLE_EXTENDED_LOGIN = 'true';
    const extendedLoginUrl = new URL(linkedinOAuth.getAuthorizationUrl('state-token'));
    expect(extendedLoginUrl.searchParams.get('enable_extended_login')).toBe('true');
  });
});
