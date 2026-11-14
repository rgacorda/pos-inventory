/**
 * Drops password hashes and reset tokens before a user row leaves the API.
 */
export function toPublicUser<T extends object>(user: T): Omit<
  T,
  'password' | 'passwordResetToken' | 'passwordResetExpires'
> {
  const safe = { ...user } as T & {
    password?: unknown;
    passwordResetToken?: unknown;
    passwordResetExpires?: unknown;
  };
  delete safe.password;
  delete safe.passwordResetToken;
  delete safe.passwordResetExpires;
  return safe;
}
