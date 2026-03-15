import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";
import * as schema from "./schema";
import { getServerEnv } from "../lib/env";

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

const serverEnv = getServerEnv();
const sql = neon(serverEnv.DATABASE_URL);
export const db = drizzle(sql, { schema });
