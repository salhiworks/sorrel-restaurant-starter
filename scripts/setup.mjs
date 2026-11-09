// Guided Supabase setup: connects your Sorrel restaurant to your Supabase project
// (Production Mode). See docs/SETUP.md.
//
//   npm run setup              walks through every step and asks before each change
//   npm run setup -- --check   only reports what is done and what isn't; changes nothing
//
// It uses this project's own pinned Supabase CLI (npx supabase) with your own
// Supabase login. It is safe to run again: every step checks first and skips
// what is already done. It never resets the database, never repairs migration
// history and never deletes data.
//
// Your owner password is typed into a hidden prompt, used once to create the
// account and never printed or saved. The project's secret key is used only to
// create that account: read through the CLI, held in memory and discarded. It is
// never printed or written into this project.

import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createInterface } from "node:readline"
import { createClient } from "@supabase/supabase-js"

const CHECK = process.argv.includes("--check")
const PINNED = JSON.parse(readFileSync("package.json", "utf8")).devDependencies?.supabase
const TABLES = ["admins", "settings", "categories", "dishes", "orders", "order_items"]
// Testing only: point the database steps at a throwaway Postgres instead of a linked project.
const TEST_DB_URL = process.env.SORREL_SETUP_DB_URL
const target = TEST_DB_URL ? ["--db-url", TEST_DB_URL] : ["--linked"]

// --- small helpers -----------------------------------------------------------

const bold = (s) => `\x1b[1m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const ok = (s) => console.log(`  ✓ ${s}`)
const todo = (s) => console.log(`  • ${s}`)
const step = (n, title) => console.log(`\n${bold(`${n}. ${title}`)}`)
class Stop extends Error {}

const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" }
/** The CLI prints progress lines, then one JSON value; return that value. */
const lastJson = (out) => {
  const start = out.search(/^[[{]/m)
  if (start < 0) throw new Error(`Unexpected Supabase CLI output:\n${out.trim()}`)
  return JSON.parse(out.slice(start))
}
function supabase(args, { json = false, inherit = false } = {}) {
  if (inherit) {
    // Only sign-in and linking may need your keyboard; nothing else reads it, so it can't swallow your answers.
    const keyboard = args[0] === "login" || args[0] === "link"
    const result = spawnSync("npx", ["supabase", ...args], { stdio: [keyboard ? "inherit" : "ignore", "inherit", "inherit"], env })
    if (result.status !== 0) throw new Stop(`npx supabase ${args.slice(0, 2).join(" ")} failed (see above).`)
    return null
  }
  const out = execFileSync("npx", ["supabase", ...args, ...(json ? ["-o", "json"] : [])], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  })
  return json ? lastJson(out) : out
}
const trySupabase = (args, options) => {
  try {
    return supabase(args, options)
  } catch {
    return null
  }
}
const query = (sql) => supabase(["db", "query", ...target, sql], { json: true }).rows ?? []

const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout, terminal: true }) : null
function ask(question, { hidden = false } = {}) {
  if (!rl) throw new Stop("This step needs your answers: run npm run setup in your own terminal (or use --check).")
  return new Promise((resolve) => {
    if (hidden) {
      const write = rl._writeToOutput
      rl._writeToOutput = (text) => (text.includes(question) ? write.call(rl, text) : write.call(rl, ""))
      rl.question(question, (answer) => {
        rl._writeToOutput = write
        process.stdout.write("\n")
        resolve(answer.trim())
      })
    } else rl.question(question, (answer) => resolve(answer.trim()))
  })
}
const confirm = async (question) => !CHECK && /^(y|yes|)$/i.test(await ask(`  ${question} [Y/n] `))

// --- steps --------------------------------------------------------------------

async function tools() {
  step(1, "Tools")
  const [major, minor] = process.versions.node.split(".").map(Number)
  if (major < 20 || (major === 20 && minor < 9)) throw new Stop(`Node.js 20.9 or newer is needed; this is ${process.versions.node}.`)
  ok(`Node.js ${process.versions.node}`)
  const version = trySupabase(["--version"])?.match(/\d+\.\d+\.\d+/)?.[0]
  if (!version) throw new Stop("The Supabase CLI didn't start. Run npm install first.")
  if (version !== PINNED) throw new Stop(`This project needs Supabase CLI ${PINNED}, but npx supabase is ${version}. Run npm install.`)
  ok(`Supabase CLI ${version} (this project's pinned version)`)
  if (TEST_DB_URL) return []
  let projects = trySupabase(["projects", "list"], { json: true })
  if (!projects) {
    todo("Not signed in to Supabase.")
    if (CHECK || !rl) throw new Stop("Sign in first: run npx supabase login in your own terminal. It opens your browser.")
    if (!(await confirm("Sign in now? A browser window opens."))) throw new Stop("Sign in with npx supabase login, then run setup again.")
    supabase(["login"], { inherit: true })
    projects = supabase(["projects", "list"], { json: true })
  }
  ok("Signed in to Supabase")
  return Array.isArray(projects) ? projects : (projects.projects ?? [])
}

async function project(projects) {
  step(2, "Project")
  if (TEST_DB_URL) return ok("Test database (SORREL_SETUP_DB_URL), not a Supabase project")
  const nameOf = (ref) => projects.find((p) => (p.ref ?? p.id) === ref)?.name
  let ref = existsSync("supabase/.temp/project-ref") ? readFileSync("supabase/.temp/project-ref", "utf8").trim() : ""
  if (ref) {
    if (!nameOf(ref)) throw new Stop(`This folder is linked to ${ref}, which isn't one of your projects. Link the right one with npx supabase link --project-ref <your Project ID>.`)
    ok(`Linked to ${bold(nameOf(ref))} — https://${ref}.supabase.co`)
    return ref
  }
  todo("No project linked yet.")
  if (CHECK) throw new Stop("Link your project first: npx supabase link --project-ref <your Project ID>.")
  console.log(dim("  Your projects:"))
  for (const p of projects) console.log(dim(`    ${p.ref ?? p.id}  ${p.name}`))
  ref = await ask("  Project ID to use for this restaurant: ")
  if (!/^[a-z0-9]{20}$/.test(ref) || !nameOf(ref)) throw new Stop("That isn't one of your Project IDs.")
  if (!(await confirm(`Link this folder to ${nameOf(ref)} (https://${ref}.supabase.co)?`))) throw new Stop("Nothing linked.")
  supabase(["link", "--project-ref", ref], { inherit: true })
  ok(`Linked to ${nameOf(ref)}`)
  return ref
}

async function database() {
  step(3, "Database (tables, security rules, order function, photo storage)")
  const files = readdirSync("supabase/migrations").filter((f) => /^\d+_.+\.sql$/.test(f)).sort()
  const local = new Set(files.map((f) => f.split("_")[0]))
  // The migration history the CLI keeps in the project (read directly: `migration list` prints a table).
  const [state] = query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as has_history, to_regclass('public.dishes') is not null as has_tables",
  )
  const remote = state.has_history ? query("select version from supabase_migrations.schema_migrations order by version").map((r) => r.version) : []
  const foreign = remote.filter((v) => !local.has(v))
  if (foreign.length) {
    throw new Stop(
      `This project's migration history has ${foreign.join(", ")}, which this folder doesn't have. ` +
        "It may belong to another app, so nothing was changed. Use an empty project for Sorrel, or ask for help.",
    )
  }
  const pending = files.filter((f) => !remote.includes(f.split("_")[0]))
  if (pending.length === 0) return ok(`Up to date (${files.join(", ")})`)
  if (remote.length === 0 && state.has_tables) {
    todo("Sorrel's tables are already here, set up by hand earlier, but not recorded in the migration history.")
    console.log(dim("  Sorrel's setup file is safe to run again: it keeps your menu, settings, orders and accounts,"))
    console.log(dim("  and recording it lets future updates apply cleanly."))
  }
  todo(`To apply: ${pending.join(", ")}`)
  if (CHECK) throw new Stop("The database isn't set up yet: run npm run setup (or ask Claude to apply the migrations).")
  console.log(dim("  Dry run first: what the Supabase CLI would apply, changing nothing."))
  supabase(["db", "push", ...target, "--dry-run"], { inherit: true })
  if (!(await confirm("Apply it now?"))) throw new Stop("The database isn't set up yet.")
  supabase(["db", "push", ...target, "--yes"], { inherit: true })
  ok("Database ready")
}

function verify() {
  step(4, "Database check")
  const [row] = query(`
    select
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          and c.relname in (${TABLES.map((t) => `'${t}'`).join(", ")})) as rls_tables,
      exists (select 1 from storage.buckets where id = 'dish-images' and public) as bucket,
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'place_order') as order_function,
      (select count(*)::int from public.dishes) as dishes
  `)
  const problems = []
  if (row.rls_tables === TABLES.length) ok(`Row Level Security on all ${TABLES.length} tables`)
  else problems.push(`Row Level Security is on for ${row.rls_tables} of ${TABLES.length} tables`)
  if (row.bucket) ok("dish-images photo storage")
  else problems.push("the dish-images storage bucket is missing")
  if (row.order_function) ok("place_order function")
  else problems.push("the place_order function is missing")
  if (problems.length) throw new Stop(`The database isn't complete: ${problems.join("; ")}. Run setup again.`)
  if (row.dishes > 0) ok(`Menu: ${row.dishes} dish(es)`)
  else todo("Menu is empty: after you sign in at /admin, click Import sample menu (or add your own dishes).")
}

async function owner(ref) {
  step(5, "Your owner account")
  const admins = query("select count(*)::int as n from public.admins")[0]?.n ?? 0
  if (admins > 0) return ok(`${admins} owner account(s) can sign in to the dashboard`)
  todo("No owner account yet")
  if (CHECK) return
  if (TEST_DB_URL) throw new Stop("Owner accounts need a real Supabase project.")
  const email = (await ask("  Your email for signing in to the dashboard: ")).toLowerCase()
  if (!/^[^@\s'"\\]+@[^@\s'"\\]+\.[^@\s'"\\]+$/.test(email)) throw new Stop("That doesn't look like an email address.")
  const exists = query(`select count(*)::int as n from auth.users where lower(email) = '${email}'`)[0]?.n > 0
  if (exists) ok(`${email} already has an account; making it the owner`)
  else {
    if (!(await confirm(`Create the account ${email} now, with a password you choose?`))) throw new Stop("No owner account yet.")
    const password = await ask("  Password, at least 10 characters (hidden): ", { hidden: true })
    if (password.length < 10) throw new Stop("Use at least 10 characters.")
    if ((await ask("  Same password again (hidden): ", { hidden: true })) !== password) throw new Stop("The passwords didn't match.")
    const keys = supabase(["projects", "api-keys", "--project-ref", ref, "--reveal"], { json: true })
    const list = Array.isArray(keys) ? keys : []
    const secret = list.find((k) => k.type === "secret")?.api_key ?? list.find((k) => k.name === "service_role")?.api_key
    if (!secret) throw new Stop("Couldn't read the project's secret key through the Supabase CLI.")
    const admin = createClient(`https://${ref}.supabase.co`, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Stop(`Creating the account failed: ${error.message}`)
    ok("Account created, email confirmed")
  }
  query(
    `insert into public.admins (user_id) select id from auth.users where lower(email) = '${email}' on conflict do nothing`,
  )
  const granted = query(
    `select count(*)::int as n from public.admins a join auth.users u on u.id = a.user_id where lower(u.email) = '${email}'`,
  )[0]?.n
  if (!granted) throw new Stop("The account couldn't be made the owner. Run setup again.")
  ok(`${email} is the owner: sign in at /admin on your website`)
}

function publishableKey(ref) {
  const keys = trySupabase(["projects", "api-keys", "--project-ref", ref], { json: true })
  const list = Array.isArray(keys) ? keys : []
  return (list.find((k) => k.type === "publishable") ?? list.find((k) => k.name === "anon"))?.api_key ?? null
}

async function signups(ref, key) {
  step(6, "Staff-only sign-in")
  if (!key) return todo("Couldn't read the Publishable key, so this wasn't checked.")
  const disabled = async () =>
    (await (await fetch(`https://${ref}.supabase.co/auth/v1/settings`, { headers: { apikey: key } })).json()).disable_signup === true
  if (await disabled()) return ok("Public sign-ups are off: only accounts you create can sign in")
  todo("Public sign-ups are on: anyone could create an account (they still couldn't manage the restaurant)")
  const page = `https://supabase.com/dashboard/project/${ref}/auth/providers`
  if (CHECK) return todo(`Turn off "Allow new users to sign up": ${page}`)
  console.log(`  Turn off "Allow new users to sign up" here, then save:\n  ${page}`)
  for (let i = 0; i < 3; i++) {
    await ask("  Press Enter when done. ")
    if (await disabled()) return ok("Public sign-ups are off")
    todo("Still on. It can take a few seconds to apply.")
  }
}

function hostinger(ref, key) {
  step(7, "Values for Hostinger (Environment variables)")
  const rows = [
    ["NEXT_PUBLIC_SUPABASE_URL", `https://${ref}.supabase.co`],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key ?? "copy the Publishable key from Connect in your Supabase Dashboard"],
    ["SUPABASE_SECRET_KEY", `copy the Secret key yourself from https://supabase.com/dashboard/project/${ref}/settings/api-keys`],
    ["TRUSTED_PROXY", "hostinger"],
    ["NEXT_PUBLIC_SITE_URL", "your website's address, e.g. https://yourrestaurant.com"],
  ]
  for (const [name, value] of rows) console.log(`  ${bold(name)}\n    ${value}`)
  console.log(dim("  The Secret key is never shown here. Paste it only into Hostinger, never into a chat or your code."))
  console.log(dim("  Save the variables, then redeploy: the public values are built into the site."))
}

// --- run ----------------------------------------------------------------------

console.log(bold(CHECK ? "Sorrel Supabase setup check (changes nothing)" : "Sorrel Supabase setup"))
try {
  const projects = await tools()
  const ref = await project(projects)
  await database()
  verify()
  if (!TEST_DB_URL) {
    await owner(ref)
    const key = publishableKey(ref)
    await signups(ref, key)
    hostinger(ref, key)
    console.log(`\n${bold("Next")}: add these to Hostinger and redeploy. Then sign in at /admin on your website and click Import sample menu.`)
  }
} catch (error) {
  console.error(`\n✗ ${error.message}`)
  process.exitCode = 1
} finally {
  rl?.close()
}
