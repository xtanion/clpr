"""Social sign-in (Google + GitHub) via OAuth 2.0.

Authlib runs the OAuth dance; it stores the transient state/nonce in the signed
session cookie (Starlette SessionMiddleware, wired up in main.py). On a successful
callback we resolve the provider profile to a stable user id (``provider:sub``),
upsert the profile row, and stash the id in the session. Every state endpoint then
authenticates through ``current_user``, which reads that session id.

The backend sits behind the Next.js dev/prod rewrite (same origin), so the OAuth
``redirect_uri`` must be the *public* app origin, not the internal FastAPI address.
That is what ``OAUTH_REDIRECT_BASE`` is for.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from . import db

OAUTH_REDIRECT_BASE = os.environ.get("OAUTH_REDIRECT_BASE", "http://localhost:3000").rstrip("/")
POST_LOGIN_REDIRECT = os.environ.get("POST_LOGIN_REDIRECT", "/")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-session-secret-change-me")
SESSION_HTTPS_ONLY = os.environ.get("SESSION_HTTPS_ONLY", "false").lower() == "true"

_PROVIDERS_CONFIGURED = bool(os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("GITHUB_CLIENT_ID"))

# Dev bypass: skip sign-in and treat every request as a single local user. OFF by
# default so real OAuth sign-in is always required; opt in explicitly with DEV_AUTH=on.
_DEV_AUTH = os.environ.get("DEV_AUTH", "").lower()
DEV_AUTH_ENABLED = _DEV_AUTH in ("1", "true", "on")
DEV_USER = "dev:local"

if DEV_AUTH_ENABLED:
    print("[auth] DEV_AUTH enabled: sign-in is skipped, all requests act as the local dev user. "
          "Do not use in production. Unset DEV_AUTH to require real sign-in.")
elif not _PROVIDERS_CONFIGURED:
    print("[auth] WARNING: sign-in is required but no OAuth provider is configured. "
          "Set GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET, or the app will be unreachable.")

oauth = OAuth()

if os.environ.get("GOOGLE_CLIENT_ID"):
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if os.environ.get("GITHUB_CLIENT_ID"):
    oauth.register(
        name="github",
        client_id=os.environ["GITHUB_CLIENT_ID"],
        client_secret=os.environ.get("GITHUB_CLIENT_SECRET"),
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def current_user(request: Request) -> str:
    """FastAPI dependency: the signed-in user's id, or 401. Replaces the old
    ``?user=`` query param — identity now comes only from the session cookie.
    With DEV_AUTH enabled, unauthenticated requests fall back to the dev user."""
    uid = request.session.get("user")
    if not uid and DEV_AUTH_ENABLED:
        return DEV_USER
    if not uid:
        raise HTTPException(status_code=401, detail="not authenticated")
    return uid


router = APIRouter()


@router.get("/api/auth/{provider}/login")
async def login(provider: str, request: Request):
    client = oauth.create_client(provider)
    if client is None:
        raise HTTPException(status_code=404, detail=f"provider '{provider}' not configured")
    redirect_uri = f"{OAUTH_REDIRECT_BASE}/api/auth/{provider}/callback"
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/api/auth/{provider}/callback")
async def callback(provider: str, request: Request):
    client = oauth.create_client(provider)
    if client is None:
        raise HTTPException(status_code=404, detail=f"provider '{provider}' not configured")
    try:
        token = await client.authorize_access_token(request)
    except OAuthError as exc:
        raise HTTPException(status_code=401, detail=f"oauth failed: {exc.error}")

    if provider == "google":
        info = token.get("userinfo") or await client.userinfo(token=token)
        sub, email = info["sub"], info.get("email", "")
        avatar = info.get("picture", "")
        username = (email.split("@")[0] if email else sub)
        name = info.get("name") or username
    elif provider == "github":
        info = (await client.get("user", token=token)).json()
        sub, avatar = str(info["id"]), info.get("avatar_url", "")
        username = info.get("login", "")
        name = info.get("name") or username
        email = info.get("email") or await _github_primary_email(client, token)
    else:
        raise HTTPException(status_code=400, detail=f"unsupported provider '{provider}'")

    uid = f"{provider}:{sub}"
    db.upsert_user(uid, email or "", name or "", username or "", avatar or "", provider, _now_iso())
    request.session["user"] = uid
    return RedirectResponse(url=POST_LOGIN_REDIRECT, status_code=303)


async def _github_primary_email(client, token) -> str:
    emails = (await client.get("user/emails", token=token)).json()
    if not isinstance(emails, list) or not emails:
        return ""
    primary = next((e for e in emails if e.get("primary")), emails[0])
    return primary.get("email", "")


@router.get("/api/auth/me")
async def me(request: Request):
    uid = request.session.get("user")
    if not uid and DEV_AUTH_ENABLED:
        if not db.profile(DEV_USER):
            db.upsert_user(DEV_USER, "dev@localhost", "Dev User", "dev", "", "dev", _now_iso())
        return db.profile(DEV_USER)
    if not uid:
        raise HTTPException(status_code=401, detail="not authenticated")
    prof = db.profile(uid)
    if not prof:
        request.session.pop("user", None)
        raise HTTPException(status_code=401, detail="not authenticated")
    return prof


@router.post("/api/auth/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return {"ok": True}


@router.get("/api/auth/providers")
def providers() -> dict[str, bool]:
    return {"google": "google" in oauth._registry, "github": "github" in oauth._registry}
