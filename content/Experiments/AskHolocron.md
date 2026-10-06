
## **askholocron.sugeesh.dev — what I built and what broke**

### **The architecture I settled on**

I split it by who does each part best. Cloudflare handles the edge: domain, tunnel, identity. My home lab holds the app and the data. OpenAI does the models.

### Decisions along the way:

- **Vector DB stays local.** I used Postgres with pgvector, running in Docker. Embeddings never leave my box.
- **LLM is an API.** My VM can't run a model, so generation and embeddings go to OpenAI. I compared Cloudflare Workers AI (priced in "neurons", ~$0.011 per thousand, 10k/day free) against OpenAI's small models (nano at $0.20/$1.25, mini at $0.75/$4.50 per million tokens) and picked OpenAI for quality and ecosystem fit. For a demo it's a few dollars a month.
- **Frontend and backend run on the host, not in Docker.** Docker runs only pgvector and cloudflared.
- **Cloudflare Zero Trust Free.** 50 seats, unlimited tunnels, everything I need.

### **The tunnel**

I created a tunnel in Zero Trust → Networks → Tunnels and ran `cloudflared` in Docker with `TUNNEL_TOKEN` from a `.env` file (Compose substitutes `${TUNNEL_TOKEN}` automatically when the file sits beside `compose.yaml`).

No ports forwarded on my router. My home IP appears nowhere in DNS.

**Every wall I hit, in order**

**1. `Unable to reach the origin service` → `localhost:4173`**  
cloudflared was on a Docker bridge network (`172.18.0.2`), so `localhost` meant inside the container, where nothing listens. I fixed it with `network_mode: host`. The alternative was `host.docker.internal` plus an `extra_hosts` entry.

**2. `Blocked request. This host is not allowed.`**  
Vite rejects unknown Host headers by design as DNS rebinding protection, so I needed `allowedHosts` in the config. The wrinkle: `server` and `preview` are separate blocks and `preview` doesn't inherit from `server`, so I had to set both. It also needs a restart, since the config isn't hot-reloaded.

**3. 404 at the root, from my origin, not Cloudflare**  
The tell was `cf-cache-status: DYNAMIC` plus `vary: Origin`. Cloudflare's own errors look completely different. `vite preview` serves `dist/`, and `dist/` was empty because I'd never run `npm run build`.  
I confirmed it by switching to `npm run dev`, which builds on the fly and worked immediately.

**4. 404 on `/api/*`, this time `{"detail":"Not Found"}`**  
Different body, different culprit. JSON meant FastAPI was answering, so the tunnel and ingress rule were correct. The routes just weren't registered under `/api`. Cloudflare forwards the full path, so the backend needed an `APIRouter(prefix="/api")`.

**The debugging pattern worth keeping:** the 404 body told me which service answered every time. Vite's is plain text with `vary: Origin`, FastAPI's is JSON, and Cloudflare's is a styled HTML page with a ray ID. Always `curl -s` for the body, not just `-I` for headers.

### **Where it stands**

Working: tunnel up, frontend served over the domain, backend answering under `/api/*`, pgvector in Docker, and `npm run build` then `npm run preview` as the serving setup.

Not yet done:

- Access application. The front door is currently open to anyone with the URL.
- Rate limiting on `/api/*` and an OpenAI spend cap
- Input length cap in the backend
- CORS is still wide open (`access-control-allow-origin: *`), which is unnecessary now that everything is same-origin.
- systemd units so the frontend and backend survive a reboot
- A service token, for when the Discord agent needs to call the API past Access

### **Still on my list**

Packaging the RAG as an agent skill, wiring my LangChain agent to Discord the way OpenClaw was, and putting the game behind the same tunnel on a second hostname.