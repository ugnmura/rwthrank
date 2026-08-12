# Deploying

Backend runs on the Hetzner box as a `/srv` stack. Frontend runs on Vercel.
Nothing in CI SSHes anywhere: the workflow pushes an image and Watchtower on the
box pulls it, which is how the other stacks there work.

```
push to main (backend/**)  ->  build  ->  registry.sushiwaumai.com  ->  Watchtower  ->  live
push to main (frontend/**) ->  Vercel git integration               ->  live
```

## One-time: the backend stack

No registry secrets. The image goes to GHCR, which the workflow's own
`GITHUB_TOKEN` can push to given `packages: write`.

After the very first successful build, make the package public once:

```sh
gh api -X PATCH /user/packages/container/rwthrank-backend \
  -f visibility=public
```

GHCR creates packages private, and a private one means the box needs a pull
credential. Public is simpler and the repo is public anyway. If you would rather
keep it private, put a read-only PAT on the box with
`docker login ghcr.io` instead.

Then on the box:

```sh
ssh hetzner
mkdir -p /srv/rwthrank
# copy deploy/rwthrank/docker-compose.yaml there, then:
cd /srv/rwthrank
cp backend.env.example backend.env   # fill in SMTP_PASSWORD
docker compose up -d
```

Add `rwthrank` to `APPS` in `/srv/Makefile` so `make up` / `make pull APP=rwthrank`
cover it like every other stack.

DNS: `rwthrank.sushiwaumai.com` needs an A record on the box before Traefik can
get a certificate. Traefik picks the container up from its labels, so there is no
proxy config to edit.

Create the dashboard superuser once the container is running:

```sh
docker compose exec rwthrank-backend /pb/rwthrank superuser upsert you@example.com <password>
```

## One-time: the frontend

Import the repo in Vercel and set **Root Directory** to `frontend`. Then one
environment variable, for all environments:

```
NEXT_PUBLIC_POCKETBASE_URL = https://rwthrank.sushiwaumai.com
```

It is read by the browser and inlined at build time, so changing it later needs a
redeploy, not just a restart.

## Mail

Receiving on mindevice.net is Cloudflare Email Routing, already enabled. A
catch-all forwards every address at the domain to the owner's inbox, and the
`contact@` rule matches ahead of it.

Sending is Resend on **rwthrank.mindevice.net**. It is deliberately a subdomain:
the root SPF (`v=spf1 include:_spf.mx.cloudflare.net ~all`) is what makes
inbound mail work, so a sending provider must not edit it. The DKIM, SPF and
feedback records Resend generates all live under the subdomain.

Resend's SMTP wants the literal username `resend` and the API key as the
password. Put the key in `backend.env` as `SMTP_PASSWORD`, never in git.

## Things that will bite

- **SMTP is not optional.** PocketBase deletes an OTP whose email fails to send,
  so a deployment without working mail issues codes that are already gone by the
  time anyone types them. Nobody can log in and nothing looks broken in the logs
  except one error line per attempt.
- **`pb_data` is the entire database**, bind-mounted from `/srv/rwthrank/pb_data`.
  It is not in any image and not in git. Back it up.
- **Disk.** The box was at roughly 72% of 38 GB at last check, before this stack.
  Images accumulate; `/srv/cleanup.sh` exists for that.
- **CORS.** The Vercel frontend calls the backend cross-origin. PocketBase allows
  all origins by default, which is fine here but worth narrowing if that changes.
- **The frontend Docker image is now unused in production.** `frontend/Dockerfile`
  still builds, and the local compose stack still uses its `dev` target, but
  Vercel builds from source and ignores it.
