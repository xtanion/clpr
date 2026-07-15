"""Request/response models and public serialization helpers."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class EntryIn(BaseModel):
    date: str = Field(..., description="ISO date YYYY-MM-DD")
    focus: int
    conf: int
    mins: str
    summary: str = ""
    notes: str = ""


class ToggleTopicIn(BaseModel):
    stage: int
    topic: int
    done: Optional[bool] = None  # None = toggle, else set explicitly


class StartDateIn(BaseModel):
    startDate: str


class CommentIn(BaseModel):
    key: str
    text: str
    author: str = "you"


class BuildArtifactIn(BaseModel):
    id: str


class ResponseIn(BaseModel):
    index: int
    value: str = ""          # numeric/free answer text
    frac: float = 0.0        # code: client-computed fraction of tests passed
    passed: bool = Field(default=False, alias="pass")
    msg: str = ""

    model_config = {"populate_by_name": True}


class AttemptIn(BaseModel):
    responses: list[ResponseIn] = []
    timeMs: int = 0


def public_quiz(quiz: dict[str, Any]) -> dict[str, Any]:
    """Strip server-only grading fields. Numeric answers and free keywords/rubric
    never leave the server; code tests are kept because grading runs in-browser."""
    out_questions = []
    for q in quiz["questions"]:
        pub = {"type": q["type"], "weight": q["weight"], "prompt": q["prompt"]}
        if q.get("hint"):
            pub["hint"] = q["hint"]
        if q["type"] == "numeric":
            pub["unit"] = q.get("unit", "")
        elif q["type"] == "code":
            pub["signature"] = q["signature"]
            pub["entry"] = q["entry"]
            pub["tests"] = q["tests"]
        out_questions.append(pub)
    return {"stage": quiz["stage"], "questions": out_questions}
