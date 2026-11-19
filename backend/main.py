"""Ayn AI layer.

A minimal FastAPI backend the published page calls for everything a static
page cannot do by itself:

  GET  /health       is the LLM configured?
  POST /api/train-brief     one train's readings + bloom forecast -> why it is
                            flagged + an action plan that quotes the numbers
  POST /api/bloom-events    web search for past harmful-algal-bloom events in
                            the Gulf that hit desalination intakes; every source
                            is then fetched live and verified before it is
                            allowed on a slide

Run:
  pip install -r requirements.txt
  set ANTHROPIC_API_KEY=sk-ant-...
  uvicorn main:app --port 8000        (from this directory)

The dashboard page defaults to http://localhost:8000 (editable in its AI card).
"""
import json
import os
import re
from pathlib import Path

import httpx
import importlib.util
import tempfile
import threading

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Optional backend/.env, so the key can live in a file instead of the shell.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:
    pass

MODEL = os.environ.get("AYN_MODEL") or os.environ.get("SEAWATCH_MODEL", "claude-sonnet-4-5")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "")   # blank = first model you have installed

BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "why_flagged": {"type": "array", "items": {"type": "string"}},
        "action_plan": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "why_flagged", "action_plan"],
}


def use_anthropic():
    """Claude if a key is set (and AYN_PROVIDER is not 'ollama'), otherwise a local Ollama model."""
    return bool(os.environ.get("ANTHROPIC_API_KEY")) and os.environ.get("AYN_PROVIDER", "") != "ollama"


OLLAMA_DOWN = ("Ollama is not running at " + OLLAMA_URL +
               ". Start it with `ollama serve`, or set ANTHROPIC_API_KEY in backend/.env")


def ollama_model():
    if OLLAMA_MODEL:
        return OLLAMA_MODEL
    try:
        r = httpx.get(OLLAMA_URL + "/api/tags", timeout=3)
    except httpx.HTTPError:
        raise RuntimeError(OLLAMA_DOWN)
    models = r.json().get("models", [])
    if not models:
        raise RuntimeError("Ollama is running but has no models. Run: ollama pull <model>")
    return models[0]["name"]


def ollama_post(body):
    """POST to Ollama, retrying once without the think switch on older models."""
    try:
        r = httpx.post(OLLAMA_URL + "/api/chat", json={**body, "think": False}, timeout=180)
        if r.status_code == 400:                 # older Ollama or a model without a think switch
            r = httpx.post(OLLAMA_URL + "/api/chat", json=body, timeout=180)
    except httpx.HTTPError:
        raise RuntimeError(OLLAMA_DOWN)
    r.raise_for_status()
    return r.json()


def ollama_json(system, user):
    """One call to Ollama with schema-constrained JSON output and thinking switched off."""
    body = {"model": ollama_model(), "stream": False, "format": BRIEF_SCHEMA,
            "options": {"temperature": 0, "num_ctx": 4096},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    return ollama_post(body)["message"]["content"]


app = FastAPI(title="Ayn AI layer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # the dashboard is a static page
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def allow_private_network(request, call_next):
    # lets a page served from https reach this server on localhost (Chrome private network access)
    resp = await call_next(request)
    resp.headers["Access-Control-Allow-Private-Network"] = "true"
    return resp


_client = None
def client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY
    return _client


@app.get("/health")
def health():
    stt = importlib.util.find_spec("faster_whisper") is not None
    if use_anthropic():
        return {"ok": True, "ai": True, "model": MODEL, "stt": stt}
    try:
        return {"ok": True, "ai": True, "model": "ollama: " + ollama_model(), "stt": stt}
    except Exception as e:
        return {"ok": True, "ai": False, "model": None, "stt": stt,
                "note": str(e)[:240]}


class TrainBrief(BaseModel):
    train: dict
    readings: dict
    forecast: dict | None = None
    bloom: dict


@app.post("/api/train-brief")
def train_brief(b: TrainBrief):
    """Explain why a train is flagged and propose an action plan, quoting numbers."""
    pass
    data = json.dumps(b.model_dump(), indent=1)
    system = (
        "You are the operations analyst for a seawater reverse-osmosis desalination plant on the Gulf. "
        "You receive structured telemetry for one membrane train plus the bloom forecast for its intake.\n"
        "Task: (1) explain in plain operator language why this train is flagged, and (2) propose an action plan.\n"
        "Rules:\n"
        "- Quote the actual numbers from the data in every point (percentages, hours, mg/m3, days).\n"
        "- Use real RO physics: organic/biological fouling concentrates on the LEAD elements and is driven by "
        "intake chlorophyll/organic load; scaling concentrates on the TAIL elements and is driven by recovery, "
        "temperature and time since the last clean.\n"
        "- Reference the P10/P50/P90 forecast window when talking about timing; a quantile band is an estimate, not a guarantee.\n"
        "- Actions must be concrete: cleaning schedule changes, intake throttling, coagulant/flotation adjustments.\n"
        "Reply with strict JSON only: {\"summary\": str, \"why_flagged\": [str, ...], \"action_plan\": [str, ...]}"
    )
    if not use_anthropic():
        try:
            text = ollama_json(system, data)
        except Exception as e:
            raise HTTPException(502, "Local model call failed: " + str(e)[:200])
        return {"raw": text, "parsed": parse_json(text)}
    msg = client().messages.create(
        model=MODEL,
        max_tokens=1200,
        system=system,
        messages=[{"role": "user", "content": data}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    return {"raw": text, "parsed": parse_json(text)}


ROOT = Path(__file__).resolve().parent.parent


def find_page():
    """The dashboard HTML sits in the folder above backend/. Downloads sometimes rename it, so match loosely."""
    for pat in ("Ayn*desalination*early*warning*.html", "Ayn*.html", "*.html"):
        hits = sorted(ROOT.glob(pat))
        if hits:
            return hits[0]
    return None


@app.on_event("startup")
def announce():
    pg = find_page()
    print("\n  Dashboard file:", pg if pg else "NOT FOUND in " + str(ROOT))
    print("  Open it at: http://localhost:<port>/   (use the port you started uvicorn on)\n")


@app.get("/")
def page():
    """Serve the dashboard from here, so the browser treats it as a normal page (microphone access works)."""
    pg = find_page()
    if pg:
        return FileResponse(pg)
    raise HTTPException(404, "Dashboard HTML not found. Looked in: " + str(ROOT))


class Ask(BaseModel):
    question: str
    data: dict
    history: list[dict] = []
    lang: str = "en"


ASK_SYSTEM = (
    "You are Ayn, the voice assistant for a seawater reverse-osmosis desalination plant dashboard. "
    "You receive the live dashboard data as JSON and answer the operator's question from that data only.\n"
    "Rules:\n"
    "- Quote the real numbers with units. The cleaning limit is data.cleaning_limit_pct percent pressure drop above the clean baseline.\n"
    "- Time to clean comes from hours_to_clean. If reaches_limit_within_72h is true, give hours_to_limit_p50 and the likely_window_h range, "
    "and say it is an estimate. If it is false, the train is not expected to reach the limit within the 72 hour forecast window: say so, "
    "give its current pressure drop and points_below_limit, and mention possible_as_early_as_h if it is set. "
    "Never say that no estimate exists just because the train is healthy.\n"
    "- clean_first_order lists train IDs from most to least urgent. Use it for questions about which train to clean first.\n"
    "- The data is simulated. If asked, say so.\n"
    "- There are no per-pipe sensors. If asked about a specific pipe, say there is no reading for that pipe, explain what that line does "
    "in a reverse-osmosis plant, and give the nearest real numbers (train pressure drop, flux, recovery, intake risk).\n"
    "- If a number is not in the data, say you do not have it. Never invent values.\n"
    "- The question comes from speech recognition and may contain mishearings. Read it using the dashboard vocabulary: "
    "'strain A3' means 'train A3', 'cleaning women' or 'cleaning lemon' means 'cleaning limit', and 'a three' or 'bee two' are train IDs.\n"
    "- Reply in the same language the question was asked in.\n"
    "- Use a warm, friendly, natural tone, like a helpful colleague, and keep it professional.\n"
    "- The answer will be read aloud: two to four short sentences, no markdown, no lists, no symbols. "
    "Write percent, cubic metres per hour, degrees Celsius, and pressure drop in words.\n"
    "Dashboard data:\n"
)


def ollama_text(system, history, user):
    body = {"model": ollama_model(), "stream": False,
            "options": {"temperature": 0.2, "num_ctx": 8192, "num_predict": 400},
            "messages": [{"role": "system", "content": system}] + history + [{"role": "user", "content": user}]}
    return ollama_post(body)["message"]["content"]


@app.post("/api/ask")
def ask(a: Ask):
    """Answer one spoken or typed question from the dashboard's current numbers."""
    system = ASK_SYSTEM + json.dumps(a.data, separators=(",", ":"))
    hist = [{"role": h["role"], "content": str(h.get("content", ""))[:1500]}
            for h in a.history[-6:] if h.get("role") in ("user", "assistant")]
    try:
        if use_anthropic():
            msg = client().messages.create(model=MODEL, max_tokens=400, system=system,
                                           messages=hist + [{"role": "user", "content": a.question}])
            text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        else:
            text = ollama_text(system, hist, a.question)
    except Exception as e:
        raise HTTPException(502, "Model call failed: " + str(e)[:200])
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    return {"answer": text}


STT_PROMPT = ("Ayn dashboard for reverse osmosis desalination. Train A1, A2, A3, A4, A5, B1, B2, B3, B4, C1, C2, C3. "
              "Plant A, Plant B, Plant C. Cleaning limit, pressure drop, permeate flow, brine, membrane vessel, feed pressure, "
              "salt passage, flux, recovery, bloom, chlorophyll, intake, pretreatment, flotation, energy recovery.")
_whisper = None


def whisper():
    """Local speech-to-text (faster-whisper). CPU by default so the GPU stays free for the language model."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(os.environ.get("AYN_STT_MODEL", "small.en"),
                                device=os.environ.get("AYN_STT_DEVICE", "cpu"),
                                compute_type=os.environ.get("AYN_STT_COMPUTE", "int8"))
    return _whisper


def _warm():
    try:
        if importlib.util.find_spec("faster_whisper"):
            whisper()
    except Exception as e:
        print("Speech model could not load:", e)


@app.on_event("startup")
def warm_up():
    threading.Thread(target=_warm, daemon=True).start()


def _transcribe(data: bytes, lang: str):
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        segs, _ = whisper().transcribe(path, language=None if lang == "auto" else lang, initial_prompt=STT_PROMPT,
                                       beam_size=5, vad_filter=True, temperature=0.0)
        return " ".join(s.text.strip() for s in segs).strip()
    finally:
        os.unlink(path)


@app.post("/api/transcribe")
async def transcribe(request: Request, lang: str = "en"):
    """Raw audio in the request body (webm/opus from the browser) -> text. Biased toward the dashboard's vocabulary."""
    data = await request.body()
    if len(data) < 500:
        raise HTTPException(400, "No audio received")
    try:
        text = await run_in_threadpool(_transcribe, data, lang)
    except Exception as e:
        raise HTTPException(502, "Transcription failed: " + str(e)[:200])
    return {"text": text}


def parse_json(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


class EventQuery(BaseModel):
    region: str = "Arabian Gulf and Strait of Hormuz"


KEYWORDS = ["bloom", "red tide", "algal", "algae", "desalination", "gulf",
            "chlorophyll", "intake", "harmful", "habs", "cyanobacteria"]


@app.post("/api/bloom-events")
def bloom_events(q: EventQuery):
    if not use_anthropic():
        raise HTTPException(501, "Web search needs the Anthropic backend; a local model has no search tool")
    """Search for past bloom events in the Gulf, then verify every cited source
    by fetching it: only sources that resolve and actually mention the topic
    are marked verified and allowed through."""
    system = (
        "You research harmful algal bloom (red tide) events in the Arabian/Persian Gulf and the Strait of "
        "Hormuz that affected seawater desalination plants or intakes. Use web search. Include well documented "
        "cases (for example the 2008-2009 Gulf of Oman red tide that shut in Fujairah desalination) plus any "
        "more recent documented events. For each event give the year, location, what happened to desalination "
        "or intakes, and cite the source URL you used. Reply with strict JSON only: "
        '{"events": [{"title": str, "year": str, "summary": str, "url": str}], "sources": [{"url": str, "title": str}]}'
    )
    msg = client().messages.create(
        model=MODEL,
        max_tokens=2400,
        system=system,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}],
        messages=[{"role": "user", "content":
                   f"Find documented past algal bloom events affecting desalination in: {q.region}. "
                   "Prefer primary/regulatory/peer-reviewed sources."}],
    )
    text = ""
    found = []
    for blk in msg.content:
        t = getattr(blk, "type", "")
        if t == "text":
            text += blk.text
        elif t == "web_search_tool_result":
            for r in (getattr(blk, "content", None) or []):
                u = getattr(r, "url", None) or (r.get("url") if isinstance(r, dict) else None)
                ti = getattr(r, "title", None) or (r.get("title") if isinstance(r, dict) else None)
                if u:
                    found.append({"url": u, "title": ti or ""})
    parsed = parse_json(text) or {}
    events = parsed.get("events", [])
    sources = parsed.get("sources", []) or [
        {"url": u, "title": ti} for u, ti in ((s["url"], s.get("title", "")) for s in found)]

    # ---- verification step: fetch each source, keep only what checks out ----
    verified = []
    with httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 Ayn/1.0"}) as hc:
        for s in sources[:8]:
            rec = {"url": s.get("url", ""), "title": s.get("title", ""), "verified": False,
                   "http_status": None, "matched": []}
            try:
                r = hc.get(rec["url"])
                rec["http_status"] = r.status_code
                if r.status_code < 400:
                    body = r.text.lower()
                    rec["matched"] = [k for k in KEYWORDS if k in body]
                    rec["verified"] = len(rec["matched"]) >= 1
            except Exception:
                rec["http_status"] = None
            verified.append(rec)

    verified.sort(key=lambda s: not s["verified"])   # verified first
    return {"events": events, "sources": verified}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
