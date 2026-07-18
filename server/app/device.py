"""Device authorization grant (RFC 8628 style) for headless clients.

A terminal client (the `clpr` TUI) can't run the browser OAuth redirect, so it:
  1. POST /api/auth/device/start  -> gets a device_code + a short user_code
  2. opens the browser at /device, where the signed-in user approves the user_code
     (POST /api/auth/device/approve, authenticated by the session cookie)
  3. polls POST /api/auth/device/poll with the device_code until it flips to
     'approved', then receives a long-lived personal bearer token.

start/poll are unauthenticated (no session) but still sit behind the shared
BACKEND_API_KEY gate like every other route; approve requires a signed-in user.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request

from . import db, schemas
from .auth import OAUTH_REDIRECT_BASE, current_user

router = APIRouter()

CODE_TTL_SECONDS = 600
POLL_INTERVAL_SECONDS = 3
_USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def _new_user_code() -> str:
    pick = lambda n: "".join(secrets.choice(_USER_CODE_ALPHABET) for _ in range(n))
    return f"{pick(4)}-{pick(4)}"


@router.post("/api/auth/device/start")
def device_start() -> dict:
    now = _now()
    user_code = _new_user_code()
    device_code = db.create_device_code(
        user_code, _iso(now), _iso(now + timedelta(seconds=CODE_TTL_SECONDS))
    )
    verification_uri = f"{OAUTH_REDIRECT_BASE}/device"
    return {
        "deviceCode": device_code,
        "userCode": user_code,
        "verificationUri": verification_uri,
        "verificationUriComplete": f"{verification_uri}?code={user_code}",
        "interval": POLL_INTERVAL_SECONDS,
        "expiresIn": CODE_TTL_SECONDS,
    }


@router.post("/api/auth/device/approve")
def device_approve(body: schemas.DeviceApproveIn, user: str = Depends(current_user)) -> dict:
    code = db.get_device_code_by_user_code(body.userCode.strip().upper())
    if code is None:
        raise HTTPException(status_code=404, detail="unknown code")
    if code["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"code already {code['status']}")
    if datetime.fromisoformat(code["expires_at"].replace("Z", "+00:00")) < _now():
        raise HTTPException(status_code=410, detail="code expired")
    if not db.approve_device_code(body.userCode.strip().upper(), user):
        raise HTTPException(status_code=409, detail="code no longer pending")
    return {"ok": True}


@router.post("/api/auth/device/poll")
def device_poll(body: schemas.DevicePollIn) -> dict:
    code = db.get_device_code(body.deviceCode)
    if code is None:
        raise HTTPException(status_code=404, detail="unknown device code")
    if datetime.fromisoformat(code["expires_at"].replace("Z", "+00:00")) < _now():
        raise HTTPException(status_code=410, detail="device code expired")
    if code["status"] in ("pending",):
        return {"status": "pending"}
    if code["status"] == "denied":
        raise HTTPException(status_code=403, detail="access denied")
    if code["status"] == "consumed":
        raise HTTPException(status_code=409, detail="device code already used")
    # approved: exchange for a token exactly once.
    raw = db.consume_device_code(body.deviceCode, _iso(_now()))
    if raw is None:
        raise HTTPException(status_code=409, detail="device code already used")
    return {"status": "approved", "token": raw, "profile": db.profile(code["uid"])}
