/**
 * Turning a caller's address into something that can be rate limited against
 * without being stored.
 *
 * Shared by both functions that rate limit. It was written inline in
 * submit-score and is lifted out here rather than copied, because two
 * definitions of a salted hash is exactly the sort of thing that drifts: change
 * the salt handling in one and the other keeps working, quietly, on a different
 * hash.
 */
import { createHash } from 'node:crypto';

/**
 * Stored as a salted hash, never as an address. It is only ever compared with
 * itself, so there is no reason to keep the original.
 *
 * A dedicated `IP_HASH_SALT` is better, but falling back to the service role
 * key keeps a deploy working rather than silently storing weakly hashed
 * addresses. An unsalted hash of an IPv4 address is not a hash, it is an
 * encoding: the whole space is four billion entries and reversing it is an
 * afternoon. Both values are server side only.
 */
export function hashAddress(address) {
  const salt = process.env.IP_HASH_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  return createHash('sha256').update(`${salt}:${address}`).digest('hex');
}

/**
 * The caller's address, from whichever header the platform actually set.
 */
export function addressFrom(request, context) {
  return (
    context?.ip ??
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}
