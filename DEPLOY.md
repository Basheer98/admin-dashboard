# Deploy Admin Dashboard

Deploy so you can access the dashboard from your phone, iPad, or any device.

## Option 1: Railway (recommended)

1. **Push your code to GitHub** (if you haven’t already).

2. **Sign up at [railway.app](https://railway.app)** and create a new project.

3. **Deploy from GitHub**
   - Click **New Project** → **Deploy from GitHub repo**.
   - Select your repo and (if asked) the root directory (where `package.json` is).
   - Railway will detect Next.js and run `npm run build` and `npm run start`.

4. **Add a volume (so data persists)**
   - In your Railway project, open your service.
   - Go to **Variables** or **Settings** → **Volumes**.
   - Click **Add Volume**, set mount path to `/data`.
   - Add a variable: **`DATA_PATH`** = **`/data/data.json`**  
     (This makes the app store `data.json` on the volume instead of the ephemeral filesystem.)

5. **Set environment variables**
   - In the same service, **Variables** tab, add:
   - **`ADMIN_EMAIL`** = your login email
   - **`ADMIN_PASSWORD`** = your login password  
   (Use the same values as in your local `.env`.)

6. **Generate a public URL**
   - **Settings** → **Networking** → **Generate Domain**.
   - You’ll get a URL like `https://your-app.up.railway.app`.

7. **Open on phone / iPad**
   - In Safari or Chrome, go to that URL and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

---

## Option 2: Render

1. **Push code to GitHub.**

2. **Sign up at [render.com](https://render.com)** → **New** → **Web Service**.

3. **Connect your repo** and set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Free or paid (free tier may sleep after inactivity).

4. **Add a disk (persistent storage)**
   - In the service, **Disks** → **Add Disk**.
   - Mount path: `/data`.
   - Add env var: **`DATA_PATH`** = **`/data/data.json`**.

5. **Environment**
   - **Environment** tab: add `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

6. **Deploy** and use the URL Render gives you on your phone/iPad.

---

## Option 3: Your own server (VPS)

1. **SSH into the server** (e.g. Ubuntu on DigitalOcean, Linode, etc.).

2. **Install Node 20+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and build**
   ```bash
   cd /opt  # or your choice
   git clone https://github.com/YOUR_USER/YOUR_REPO.git admin-dashboard
   cd admin-dashboard
   npm ci
   npm run build
   ```

4. **Create `.env`**
   ```bash
   echo "ADMIN_EMAIL=you@example.com" >> .env
   echo "ADMIN_PASSWORD=your-secure-password" >> .env
   # Optional: DATA_PATH=/var/lib/admin-dashboard/data.json
   ```

5. **Run with PM2 (keeps it running)**
   ```bash
   sudo npm install -g pm2
   pm2 start npm --name "admin-dashboard" -- start
   pm2 save && pm2 startup
   ```

6. **Put Nginx in front (HTTPS)**  
   Point a domain to the server and proxy to `http://127.0.0.1:3000`. Use Let’s Encrypt for SSL.

---

## Environment variables (all platforms)

| Variable         | Required | Description |
|------------------|----------|-------------|
| `ADMIN_EMAIL`    | Yes      | Login email |
| `ADMIN_PASSWORD` | Yes      | Login password |
| `DATA_PATH`      | No       | Path to `data.json`. Set to e.g. `/data/data.json` when using a mounted volume so data persists. |

---

## First-time setup after deploy

1. Open your deployed URL.
2. Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Create a project and assignments as you do locally.
4. (Optional) In **Settings**, download a backup so you have a copy of `data.json`.

If you use a volume/disk and set `DATA_PATH`, your data will persist across redeploys and restarts.
