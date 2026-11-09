# Connecting Supabase (Production Mode)

Sorrel runs in Demo Mode until it is connected to a Supabase project. This guide connects it, so you get real orders, a menu and settings saved in your database, and a dashboard only you can sign in to. It is step 4 of the [Profit Studio workflow](../README.md#the-profit-studio-workflow): your site is already live on Hostinger in Demo Mode.

You need a free [Supabase](https://supabase.com) account. Everything below uses this project's own Supabase CLI, pinned in `package.json` (`supabase` **2.122.0**) and run with `npx supabase` after `npm install`, so there is nothing to install globally and no Docker.

## The quick way: ask Claude

1. In Supabase, create a **new, empty project**. Any region and the free plan are fine. Save the database password somewhere safe; you won't need it here.
2. Copy its **Project ID**: **Project Settings → General**. It's also the part before `.supabase.co` in the Project URL.
3. Open this folder in [Claude Desktop](https://claude.ai/download)'s **Code** tab and ask Claude to connect Supabase with your Project ID, following this file.

Claude does the technical part with your Supabase login: it links the folder, shows you the project's name to confirm, checks the migration history, shows a dry run and applies the database. Two things are yours, because they need your browser or a secret:

- **Sign in to Supabase once.** Run `npx supabase login` in your own terminal. It opens your browser.
- **Create your owner account.** Run `npm run setup` in your own terminal, not through Claude. It skips what's already done and asks for your email and a password in a hidden prompt.

Never paste a password or a secret key into the chat, or into a `!` command, which shares it with Claude.

## `npm run setup`

```bash
npm install
npx supabase login        # once; opens your browser
npm run setup
```

It walks through every step, explaining and asking before each change:

1. **Tools**: Node.js 20.9 or newer, the pinned Supabase CLI, and your Supabase login.
2. **Project**: links this folder to your project and shows its name and address first.
3. **Database**: reads the project's migration history and stops if it holds migrations from another app. It shows a dry run, then applies `supabase/migrations` with `npx supabase db push`: the tables, the security rules (Row Level Security), the order function and the `dish-images` photo storage.
4. **Database check**: Row Level Security on all six tables, the photo storage and the order function.
5. **Your owner account**: creates it with the email and password you type (the password is hidden, at least 10 characters, and never saved) and adds it to the dashboard's owner list. If the account already exists, it only adds it to the list.
6. **Staff-only sign-in**: checks that public sign-ups are off, and links you to the page to turn them off if they aren't.
7. **Values for Hostinger**: prints your Project URL and Publishable key, and where to copy the Secret key.

Run it again at any time: what's already done is skipped. `npm run setup -- --check` only reports what's done and what isn't, and changes nothing.

It never resets the database, never repairs migration history, never deletes data, and never prints or saves your Secret key or password. It reads the Secret key through your CLI login only to create your owner account, and forgets it afterwards.

## Then, on Hostinger

1. Open your Node.js app's **Environment variables** and add:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL (`npm run setup` prints it) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the Publishable key (`sb_publishable_…`; printed too) |
   | `SUPABASE_SECRET_KEY` | the Secret key (`sb_secret_…`). Copy it yourself from **Project Settings → API Keys**. Server only: never share it or put it in code |
   | `TRUSTED_PROXY` | `hostinger` |
   | `NEXT_PUBLIC_SITE_URL` | your website's address, e.g. `https://harbourkitchen.ie` |
   | `ORDER_IP_SALT` | optional: any long random string |

2. **Redeploy.** The public values are built into the site, so every change needs a rebuild.
3. Open `/admin` on your site, sign in with your owner account and click **Import sample menu**. It copies the restaurant in `lib/seed.ts` (with your changes from step 3) into your database. Or start from an empty menu.
4. While signed in, open `/admin/connection-check`. See [Order rate limiting behind a proxy](../README.md#order-rate-limiting-behind-a-proxy).

## Already set up by hand?

Earlier versions of this README ran `supabase/migrations/0001_init.sql` in the SQL Editor. The setup recognises that: the tables are there, but the migration history is empty. The file is written to be safe to run again (every statement is idempotent), so `npm run setup` shows you this, asks, and applies it through the CLI. That keeps your menu, settings, orders and accounts, and records the migration so future updates apply cleanly.

A project whose history already lists `0001` is up to date, and nothing is applied.

## Without the CLI (fallback)

If the CLI can't reach your project, the same setup works by hand:

1. In **SQL Editor**, paste and run the whole of `supabase/migrations/0001_init.sql`.
2. In **Authentication → Users**, click **Add user → Create new user**, enter your email and a strong password, and leave **Auto Confirm User** ticked.
3. Make that user the owner in the **SQL Editor**:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com'
   on conflict do nothing;
   ```

4. In **Authentication → Sign In / Providers**, turn off **Allow new users to sign up**.

Then continue with [Then, on Hostinger](#then-on-hostinger). Use one method or the other; if you later run `npm run setup`, it recognises the manual setup as described above.

## For Claude

When a user asks you to connect Supabase:

- Use only this project's pinned CLI: run `npm install`, then check that `npx supabase --version` shows the version in `package.json`. Never a global `supabase`, never Docker or a local database.
- If `npx supabase projects list` fails, the user isn't signed in: ask them to run `npx supabase login` in their own terminal.
- Link with `npx supabase link --project-ref <Project ID>`, then show the project's name (`supabase/.temp/linked-project.json`) and URL, and ask the user to confirm it.
- Run `npm run setup -- --check` and read it. If the database step lists something to apply, show `npx supabase db push --linked --dry-run`, then apply with `npx supabase db push --linked`. Stop and explain if the history holds migrations this folder doesn't have.
- Never run `supabase db reset`, `supabase migration repair`, or anything that deletes data. Never use `--reveal`, and never ask for or handle a password or the Secret key. Owner accounts are created by the user with `npm run setup` in their own terminal.
- Don't write new SQL or change the schema; the setup is `supabase/migrations`, nothing else.
- Finish with `npm run setup -- --check`, and tell the user which values to add to Hostinger (it prints them), that the Secret key comes from **Project Settings → API Keys**, and to redeploy.
