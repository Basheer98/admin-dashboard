# Deploy Admin Dashboard

Deploy so you can access the dashboard from your phone, iPad, or any device.

**The app uses PostgreSQL.** Set `DATABASE_URL` on your service. Data is stored in the database, not in a file.

---

## Option 1: Railway (recommended)

1. **Push your code to GitHub** (if you haven’t already).

2. **Sign up at [railway.app](https://railway.app)** and create a new project.

3. **Add PostgreSQL**
   - In the project, click **New** → **Database** → **PostgreSQL**.
   - Wait for it to deploy, then open the Postgres service.
   - Click **Connect** → copy the variable reference: `${{ Postgres.DATABASE_URL }}`.

4. **Deploy your app from GitHub**
   - **New** → **GitHub Repo** → select your repo.
   - Set **Root Directory** to the folder that contains `package.json` (e.g. `admin-dashboard`).
   - Railway will detect Next.js and run `npm run build` and `npm run start`.

5. **Connect the app to Postgres**
   - Open your **admin-dashboard** service (not Postgres).
   - Go to **Variables** → **New Variable** (or **Raw Editor**).
   - Add **`DATABASE_URL`** = **`${{ Postgres.DATABASE_URL }}`** (the reference from step 3).
   - Add **`ADMIN_EMAIL`** = your login email.
   - Add **`ADMIN_PASSWORD`** = your login password.

6. **Generate a public URL**
   - **Settings** → **Networking** → **Generate Domain**.
   - You’ll get a URL like `https://your-app.up.railway.app`.

7. **Use the app**
   - Open that URL, log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Tables are created automatically on first use.
   - In **Settings** you can download a backup (exports from the database) or restore from a backup file.

---

## Option 2: Render

1. **Push code to GitHub.**

2. **Sign up at [render.com](https://render.com)**. Create a **PostgreSQL** database (Dashboard → New → PostgreSQL), note the **Internal Database URL**.

3. **New** → **Web Service** → connect your repo. Set build command: `npm install && npm run build`, start: `npm run start`.

4. **Environment**
   - Add **`DATABASE_URL`** = your Postgres connection string (Internal Database URL).
   - Add **`ADMIN_EMAIL`** and **`ADMIN_PASSWORD`**.

5. Deploy and use the URL Render gives you.

---

## Option 3: Your own server (VPS)

1. **Install Node 20+** and **PostgreSQL** on the server.

2. **Create a database and user**, then set **`DATABASE_URL`** in `.env` (see table below).

3. **Clone, install, build**
   ```bash
   git clone https://github.com/YOUR_USER/YOUR_REPO.git admin-dashboard
   cd admin-dashboard
   npm ci
   npm run build
   ```

4. **Run with PM2**
   ```bash
   pm2 start npm --name "admin-dashboard" -- start
   pm2 save && pm2 startup
   ```

5. Put **Nginx** (or Caddy) in front with HTTPS and proxy to `http://127.0.0.1:3000`.

---

## Environment variables

| Variable          | Required | Description |
|------------------|----------|-------------|
| `DATABASE_URL`   | Yes      | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/dbname`) |
| `ADMIN_EMAIL`    | Yes      | Login email |
| `ADMIN_PASSWORD` | Yes      | Login password |

---

## First-time setup after deploy

1. Open your deployed URL.
2. Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Create projects, assignments, and payments as needed.
4. In **Settings** you can download a backup (JSON) or restore from a previous backup file.

Data is stored in PostgreSQL, so it persists as long as the database is retained (Railway/Render keep the DB; on a VPS, back up Postgres regularly).
