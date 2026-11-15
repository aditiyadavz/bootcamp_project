// Checks a request body against a Zod schema before the route runs.
// Anything that does not match is refused with a clear message.
import { z } from 'zod';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

export const objectId = z.string({ error: 'Invalid ID.' }).regex(/^[a-f\d]{24}$/i, 'Invalid ID.');

export const text = (field, max) => z.string({ error: `Please enter ${field}.` })
  .trim()
  .min(1, `Please enter ${field}.`)
  .max(max, `Please keep ${field} under ${max} characters.`);

export const password = z.string({ error: 'Please enter a password.' })
  .min(8, 'Password must have at least 8 characters.')
  .max(100, 'Password is too long.');

export const systemId = z.string({ error: 'Please enter a System ID.' })
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,30}$/, 'System ID must be 3 to 30 letters, numbers, - or _.');

export const dateValue = z.coerce.date({ error: 'Please enter a valid date.' });
