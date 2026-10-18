import { z } from 'zod';

export const ProfileSchema = z.object({
  name: z.string().trim().max(80).default(''),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value + 'T00:00:00');
      return (
        !isNaN(date.getTime()) &&
        date.getFullYear() >= 1900 &&
        date.getFullYear() === Number(value.slice(0, 4)) &&
        date.getMonth() + 1 === Number(value.slice(5, 7)) &&
        date.getDate() === Number(value.slice(8, 10)) &&
        date <= new Date()
      );
    }, 'Enter a real birthday in the past.')
    .optional(),
  heightCm: z.number().finite().min(50).max(300).optional(),
  initialWeightKg: z.number().finite().positive().max(1000).optional(),
  initialWeightEntryId: z.string().min(1).max(200).optional(),
  onboarding: z.enum(['completed', 'skipped']).optional(),
  updatedAt: z.string().datetime().optional(),
});
export type UserProfile = z.infer<typeof ProfileSchema>;

export function ageOn(birthday: string, today = new Date()) {
  const birth = new Date(birthday + 'T12:00:00');
  const years = today.getFullYear() - birth.getFullYear();
  return (
    years -
    (today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
      ? 1
      : 0)
  );
}
