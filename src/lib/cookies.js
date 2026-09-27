/**
 * Minimal cookie helpers shared by the cart and the admin session.
 *
 * Both cookies hold an opaque value (a cart id, a signed session) so the only
 * jobs here are reading one value out of the request header and building a
 * well-formed `set-cookie` string.
 */

export const readCookie = (request, name) => {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
};

export const serializeCookie = (name, value, { maxAge = 0, path = '/', httpOnly = true, sameSite = 'Lax' } = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`];
  if (httpOnly) parts.push('HttpOnly');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
};

/** Appends a `set-cookie` header for `name` to a Headers instance. */
export const setCookie = (headers, name, value, options) =>
  headers.append('set-cookie', serializeCookie(name, value, options));
