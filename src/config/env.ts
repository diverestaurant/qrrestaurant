import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://127.0.0.1:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en-MY"),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().length(3).default("MYR"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().default("Asia/Kuching"),
});

const serverEnvSchema = publicEnvSchema.extend({ SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional() });

let publicEnv: z.infer<typeof publicEnvSchema> | undefined;
let serverEnv: z.infer<typeof serverEnvSchema> | undefined;

export function getPublicEnv() {
  if (!publicEnv) publicEnv = publicEnvSchema.parse(process.env);
  return publicEnv;
}

export function getServerEnv() {
  if (!serverEnv) serverEnv = serverEnvSchema.parse(process.env);
  return serverEnv;
}

export function getEnvironmentSummary() {
  const env = getServerEnv();
  return { appUrl: env.NEXT_PUBLIC_APP_URL, defaultCurrency: env.NEXT_PUBLIC_DEFAULT_CURRENCY, defaultTimezone: env.NEXT_PUBLIC_DEFAULT_TIMEZONE, hasServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) };
}
