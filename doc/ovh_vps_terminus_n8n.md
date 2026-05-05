# OVH VPS guide for Terminus and n8n

This guide walks through putting Terminus and n8n on your OVH VPS.

Your VPS is just a remote Linux computer. We will connect to it from your Mac, install Docker, copy Terminus there, start the stack, then tell your TRMNL device to use the VPS.

For this first version, we will use the public IP directly:

- VPS IPv4: `167.114.113.21`
- Terminus: `http://167.114.113.21:2300`
- n8n: `http://167.114.113.21:5678`
- TRMNL API Server: `http://167.114.113.21:2300`

After DNS and HTTPS are set up, the final public URLs will be:

- Terminus: `https://terminus.goodideed.com`
- n8n: `https://n8n.goodideed.com`
- TRMNL API Server: `https://terminus.goodideed.com`

Do not add a trailing slash to the TRMNL API Server value.

## Before you start

You need:

- Your OVH VPS is active.
- The VPS is running Ubuntu 24.04.
- The VPS IPv4 is `167.114.113.21`.
- You have the SSH password or SSH key for the VPS.
- You can open Terminal on your Mac.
- Your local Terminus repo is at `/Users/jpl/Dev/terminus`.

Do not skip these safety notes:

- Do not expose Postgres or Valkey publicly.
- This first setup uses plain HTTP and the VPS IP. Add a domain and HTTPS later.
- Keep your local Docker setup until the VPS version is confirmed working.
- Do the empty VPS setup first. Migrate existing data only after the empty stack works.
- Do not change the existing DNS records for `goodideed.com` or `www.goodideed.com`; only add the two subdomains below.

## Step 1: Connect to the VPS

Open Terminal on your Mac.

Try:

```bash
ssh ubuntu@167.114.113.21
```

If that does not work, try:

```bash
ssh root@167.114.113.21
```

If this is your first time connecting, SSH may ask:

```text
Are you sure you want to continue connecting?
```

Type:

```text
yes
```

Then press Enter.

## Step 2: Update Ubuntu

Run these commands on the VPS:

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

The VPS will disconnect when it reboots. Wait about a minute, then reconnect:

```bash
ssh ubuntu@167.114.113.21
```

Or, if you used root before:

```bash
ssh root@167.114.113.21
```

## Step 3: Install basic protection

Run this on the VPS:

```bash
sudo apt install -y ufw fail2ban unattended-upgrades git curl ca-certificates
```

Allow only SSH, Terminus, and n8n through the firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 2300/tcp
sudo ufw allow 5678/tcp
sudo ufw enable
```

When asked:

```text
Command may disrupt existing ssh connections. Proceed with operation (y|n)?
```

Type:

```text
y
```

Check the firewall:

```bash
sudo ufw status
```

You should see `OpenSSH`, `2300/tcp`, and `5678/tcp` allowed.

## Step 4: Install Docker

Run these commands on the VPS:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add the Docker package source:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Allow your current user to run Docker:

```bash
sudo usermod -aG docker $USER
```

Log out and back in so the Docker group applies:

```bash
exit
```

Reconnect:

```bash
ssh ubuntu@167.114.113.21
```

Or:

```bash
ssh root@167.114.113.21
```

Test Docker:

```bash
docker --version
docker compose version
```

## Step 5: Clone Terminus

Run this on the VPS:

```bash
sudo mkdir -p /opt/terminus
sudo chown $USER:$USER /opt/terminus
git clone https://github.com/usetrmnl/terminus /opt/terminus
cd /opt/terminus
```

## Step 6: Create the VPS `.env`

Create the `.env` file:

```bash
nano .env
```

Paste this:

```env
HANAMI_PORT=2300

API_URI=http://167.114.113.21:2300
APP_SECRET=replace-this-with-a-long-random-secret

DATABASE_NAME=terminus
DATABASE_PASSWORD=replace-this-with-a-long-random-database-password
DATABASE_PORT=5432
DATABASE_USER=terminus

KEYVALUE_DATABASE=0
KEYVALUE_PASSWORD=replace-this-with-a-long-random-keyvalue-password
KEYVALUE_PORT=6379
```

Replace these three values with long random strings:

- `APP_SECRET`
- `DATABASE_PASSWORD`
- `KEYVALUE_PASSWORD`

You can generate random values on the VPS with:

```bash
openssl rand -hex 32
```

Run it three times and paste one value into each field.

Save in nano:

- Press `Control-O`
- Press Enter
- Press `Control-X`

## Step 7: Create a VPS override file

The normal upstream `compose.yml` publishes Terminus, Postgres, and Valkey ports, and it might not include n8n. On the VPS, only Terminus and n8n should be public.

Create an override file:

```bash
nano compose.override.yml
```

Paste this:

```yaml
services:
  database:
    ports: !reset []

  keyvalue:
    ports: !reset []

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    volumes:
      - n8n-data:/home/node/.n8n
    environment:
      - N8N_HOST=0.0.0.0
      - WEBHOOK_URL=http://167.114.113.21:5678
    restart: unless-stopped

volumes:
  n8n-data:
```

Save in nano:

- Press `Control-O`
- Press Enter
- Press `Control-X`

## Step 8: Start the stack

Run this on the VPS:

```bash
docker compose up -d
```

Check that everything is running:

```bash
docker compose ps
```

You want to see these services running:

- `web`
- `worker`
- `database`
- `keyvalue`
- `n8n`

If something is not healthy yet, wait one minute and run:

```bash
docker compose ps
```

again.

## Step 9: Test from your Mac

Open a new Terminal window on your Mac, not inside SSH.

Test Terminus:

```bash
curl -i http://167.114.113.21:2300/up
```

A redirect to `/login` is OK.

Test n8n:

```bash
curl -i http://167.114.113.21:5678
```

A `200 OK` response is good.

## Step 10: Open the apps in a browser

Open:

```text
http://167.114.113.21:2300
```

That is Terminus.

Open:

```text
http://167.114.113.21:5678
```

That is n8n.

## Step 11: Enter the TRMNL API Server

In the TRMNL setup screen, enter:

```text
http://167.114.113.21:2300
```

Important:

- Do not enter the n8n URL.
- Do not add a trailing slash.
- Do not use the old local IP.

## Step 12: Add DNS for the public domain

Only do this after the IP-based URLs work.

The existing website at `goodideed.com` can stay where it is. Do not edit the existing `goodideed.com` or `www.goodideed.com` DNS records.

Add only these two DNS records wherever `goodideed.com` DNS is managed:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `terminus` | `167.114.113.21` |
| `A` | `n8n` | `167.114.113.21` |

After adding them, wait for DNS propagation.

From your Mac, check:

```bash
dig +short terminus.goodideed.com
dig +short n8n.goodideed.com
```

Both should eventually return:

```text
167.114.113.21
```

If `dig` is not available, use:

```bash
nslookup terminus.goodideed.com
nslookup n8n.goodideed.com
```

## Step 13: Add HTTPS with Caddy

Caddy will sit in front of Terminus and n8n. It will receive public HTTPS traffic on ports `80` and `443`, then forward traffic to the local Docker services.

SSH into the VPS:

```bash
ssh ubuntu@167.114.113.21
cd /opt/terminus
```

Update the firewall to allow HTTP and HTTPS:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Edit `compose.override.yml`:

```bash
nano compose.override.yml
```

Replace the whole file with this:

```yaml
services:
  web:
    ports: !reset []

  database:
    ports: !reset []

  keyvalue:
    ports: !reset []

  n8n:
    image: n8nio/n8n:latest
    ports: !reset []
    volumes:
      - n8n-data:/home/node/.n8n
    environment:
      - N8N_HOST=n8n.goodideed.com
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.goodideed.com
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      web:
        condition: service_healthy
      n8n:
        condition: service_started

volumes:
  n8n-data:
  caddy-data:
  caddy-config:
```

Save in nano:

- Press `Control-O`
- Press Enter
- Press `Control-X`

Create the Caddy config:

```bash
nano Caddyfile
```

Paste this:

```caddyfile
terminus.goodideed.com {
	reverse_proxy web:2300
}

n8n.goodideed.com {
	reverse_proxy n8n:5678
}
```

Save in nano.

Update `.env` so Terminus knows its final public URL:

```bash
nano .env
```

Change:

```env
API_URI=http://167.114.113.21:2300
```

to:

```env
API_URI=https://terminus.goodideed.com
```

Save in nano.

Recreate the affected services:

```bash
docker compose up -d --force-recreate web worker n8n caddy
docker compose ps
```

## Step 14: Test HTTPS

From your Mac:

```bash
curl -i https://terminus.goodideed.com/up
curl -i https://n8n.goodideed.com
```

Open in your browser:

```text
https://terminus.goodideed.com
```

and:

```text
https://n8n.goodideed.com
```

If Caddy is still requesting certificates, wait one or two minutes and try again.

## Step 15: Update TRMNL and dashboard URLs

Once HTTPS works, the TRMNL API Server should be:

```text
https://terminus.goodideed.com
```

Important:

- Do not add a trailing slash.
- Do not use the old IP URL anymore.
- Do not enter the n8n URL.

For the dashboard extension in Terminus, update the n8n webhook URL from:

```text
http://167.114.113.21:5678/webhook/dashboard
```

to:

```text
https://n8n.goodideed.com/webhook/dashboard
```

## Optional: migrate your local data

Only do this after the empty VPS stack works.

The empty VPS setup is enough to prove the server works. Migration is only needed if you want your existing local Terminus and n8n data on OVH.

The local Docker volumes are:

- `terminus_database-data`
- `terminus_n8n-data`
- `terminus_web-uploads`

### Migration overview

The safe order is:

1. Export the local database.
2. Export the local n8n data volume.
3. Export the local uploads volume.
4. Copy the files to the VPS.
5. Stop the VPS stack.
6. Restore the files.
7. Start the VPS stack.
8. Test Terminus and n8n again.

### Create backup files on your Mac

Run these from your local repo:

```bash
cd /Users/jpl/Dev/terminus
mkdir -p /Users/jpl/Dev/terminus/tmp/vps-backup
```

Export the database:

```bash
docker compose exec database pg_dump --username terminus --dbname terminus > tmp/vps-backup/terminus.sql
```

Export n8n data:

```bash
docker run --rm -v terminus_n8n-data:/data -v /Users/jpl/Dev/terminus/tmp/vps-backup:/backup alpine tar czf /backup/n8n-data.tar.gz -C /data .
```

Export uploads:

```bash
docker run --rm -v terminus_web-uploads:/data -v /Users/jpl/Dev/terminus/tmp/vps-backup:/backup alpine tar czf /backup/web-uploads.tar.gz -C /data .
```

Copy the backups to the VPS:

```bash
scp tmp/vps-backup/terminus.sql tmp/vps-backup/n8n-data.tar.gz tmp/vps-backup/web-uploads.tar.gz ubuntu@167.114.113.21:/opt/terminus/
```

If you use root:

```bash
scp tmp/vps-backup/terminus.sql tmp/vps-backup/n8n-data.tar.gz tmp/vps-backup/web-uploads.tar.gz root@167.114.113.21:/opt/terminus/
```

### Restore on the VPS

SSH into the VPS and go to Terminus:

```bash
ssh ubuntu@167.114.113.21
cd /opt/terminus
```

Stop the stack:

```bash
docker compose down
```

Start only the database once:

```bash
docker compose up -d database
```

Wait until it is healthy:

```bash
docker compose ps
```

Restore the database:

```bash
cat terminus.sql | docker compose exec -T database psql --username terminus --dbname terminus
```

Start n8n once so Docker creates its volume, then stop it:

```bash
docker compose up -d n8n
docker compose stop n8n
```

Restore n8n data:

```bash
docker run --rm -v terminus_n8n-data:/data -v /opt/terminus:/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/n8n-data.tar.gz -C /data"
```

Start web once so Docker creates uploads, then stop it:

```bash
docker compose up -d web
docker compose stop web
```

Restore uploads:

```bash
docker run --rm -v terminus_web-uploads:/data -v /opt/terminus:/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/web-uploads.tar.gz -C /data"
```

Start everything:

```bash
docker compose up -d
docker compose ps
```

## Troubleshooting

### SSH says connection refused

Check:

- The VPS is active in OVH.
- The IP is exactly `167.114.113.21`.
- Try both users:

```bash
ssh ubuntu@167.114.113.21
ssh root@167.114.113.21
```

### Browser cannot reach Terminus

SSH into the VPS and run:

```bash
cd /opt/terminus
docker compose ps
sudo ufw status
```

Check:

- `web` is running and healthy.
- Firewall allows `2300/tcp`.
- You are opening `http://167.114.113.21:2300`.

### n8n shows the old local URL

Check the override file:

```bash
cd /opt/terminus
cat compose.override.yml
```

It should contain:

```yaml
WEBHOOK_URL=https://n8n.goodideed.com
```

Recreate n8n:

```bash
docker compose up -d --force-recreate n8n
```

### TRMNL device cannot connect

Confirm the API Server field is exactly:

```text
https://terminus.goodideed.com
```

Check:

- No trailing slash.
- Not the n8n URL.
- Not the old local IP.
- Ports `80` and `443` are allowed in the VPS firewall.

From your Mac, test:

```bash
curl -i https://terminus.goodideed.com/up
```

### Postgres or Valkey are visible publicly

They should not be public.

From the VPS, check:

```bash
cd /opt/terminus
docker compose ps
```

After HTTPS is enabled, only `caddy` should publish `80` and `443`.

If `database` publishes `5432` or `keyvalue` publishes `6379`, check that `compose.override.yml` exists and contains:

```yaml
services:
  database:
    ports: !reset []

  keyvalue:
    ports: !reset []
```

Then recreate:

```bash
docker compose up -d --force-recreate
```

### HTTPS does not work

Check DNS first:

```bash
dig +short terminus.goodideed.com
dig +short n8n.goodideed.com
```

Both must return:

```text
167.114.113.21
```

Then check Caddy:

```bash
cd /opt/terminus
docker compose logs --tail 100 caddy
```

Common causes:

- DNS has not propagated yet.
- Firewall does not allow `80/tcp` and `443/tcp`.
- Another service is already using port `80` or `443`.
- `Caddyfile` has a typo.

## Later improvements

After HTTPS works, the next upgrades are:

- Add automated database and volume backups.
- Close public ports `2300` and `5678` if they are still open in OVH or UFW.
- Add basic access protection in front of n8n if you do not want the editor publicly reachable.
- Replace IP-only references in old docs, workflows, and extension URLs.
