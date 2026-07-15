"""Static content for the clpr learning tracks.

This is a faithful port of the frontend `lib/data.ts`. Keeping it here makes the
server the single source of truth: content endpoints render from this module and
the quiz answers/keywords/tests never leave the server (see grading.py).
"""

from __future__ import annotations

from typing import Any, Optional, TypedDict


class Resource(TypedDict):
    label: str
    url: str
    type: str  # "read" | "code" | "video" | "paper"


class Topic(TypedDict, total=False):
    label: str
    res: list[Resource]
    build: bool


class Stage(TypedDict):
    alt: str
    title: str
    blurb: str
    topics: list[Topic]


def _r(label: str, url: str, type: str) -> Resource:
    return {"label": label, "url": url, "type": type}


roadmap: list[Stage] = [
    {
        "alt": "Base camp",
        "title": "Foundations you can't skip",
        "blurb": "Backprop, a tiny transformer, and the paper that started it.",
        "topics": [
            {"label": "micrograd and backprop from scratch (Karpathy, Zero to Hero)", "res": [_r("The spelled-out intro to backprop", "https://www.youtube.com/watch?v=VMj-3S1tku0", "video")]},
            {"label": "makemore: build an MLP language model", "res": [_r("makemore part 2 (MLP)", "https://www.youtube.com/watch?v=TCH_1BHY58I", "video")]},
            {"label": "Read The Illustrated Transformer end to end", "res": [_r("jalammar.github.io", "https://jalammar.github.io/illustrated-transformer/", "read")]},
            {"label": "Read Attention Is All You Need, section by section", "res": [_r("arXiv 1706.03762", "https://arxiv.org/abs/1706.03762", "paper")]},
        ],
    },
    {
        "alt": "Ascent I",
        "title": "Build a GPT that generates",
        "blurb": "From tokenizer to a working sampling loop.",
        "topics": [
            {"label": "Let's build GPT from scratch (Karpathy)", "res": [_r("nanoGPT lecture", "https://www.youtube.com/watch?v=kCc8FmEb1nY", "video")]},
            {"label": "Read and run nanoGPT", "res": [_r("karpathy/nanoGPT", "https://github.com/karpathy/nanoGPT", "code")]},
            {"label": "Implement a minbpe byte-pair tokenizer", "res": [_r("karpathy/minbpe", "https://github.com/karpathy/minbpe", "code")]},
            {"label": "Write your own sampling loop: greedy, temperature, top-k, top-p", "res": [], "build": True},
        ],
    },
    {
        "alt": "Ascent II",
        "title": "The decode loop and the KV cache",
        "blurb": "Prefill vs decode, and why the cache exists.",
        "topics": [
            {"label": "Understand prefill vs decode phases", "res": [_r("Making Deep Learning Go Brrrr", "https://horace.io/brrr_intro.html", "read")]},
            {"label": "Add a KV cache to nanoGPT", "res": [], "build": True},
            {"label": "Roofline and arithmetic intensity", "res": [_r("horace.io", "https://horace.io/brrr_intro.html", "read")]},
            {"label": "Reproduce GPT-2 124M (build-nanogpt / llm.c)", "res": [_r("build-nanogpt", "https://github.com/karpathy/build-nanogpt", "code")]},
        ],
    },
    {
        "alt": "The ridge",
        "title": "Attention kernels and IO-awareness",
        "blurb": "FlashAttention, and why memory movement is the game.",
        "topics": [
            {"label": "Read the FlashAttention paper", "res": [_r("arXiv 2205.14135", "https://arxiv.org/abs/2205.14135", "paper")]},
            {"label": "Read FlashAttention-2", "res": [_r("arXiv 2307.08691", "https://arxiv.org/abs/2307.08691", "paper")]},
            {"label": "Read the FlashAttention-3 write-up", "res": [_r("tridao.me blog", "https://tridao.me/blog/2024/flash3/", "read")]},
            {"label": "Read the flash-attention repo kernels", "res": [_r("Dao-AILab/flash-attention", "https://github.com/Dao-AILab/flash-attention", "code")]},
        ],
    },
    {
        "alt": "High camp",
        "title": "Quantization",
        "blurb": "Number formats, k-quants, and calibration-aware methods.",
        "topics": [
            {"label": "Number formats: FP16, BF16, FP8, INT8, INT4", "res": [], "build": True},
            {"label": "GGUF / GGML k-quants", "res": [_r("llama.cpp", "https://github.com/ggerganov/llama.cpp", "read")]},
            {"label": "Build llama.cpp and quantize a model", "res": [], "build": True},
            {"label": "Read GPTQ and AWQ", "res": [_r("GPTQ 2210.17323", "https://arxiv.org/abs/2210.17323", "paper"), _r("AWQ 2306.00978", "https://arxiv.org/abs/2306.00978", "paper")]},
        ],
    },
    {
        "alt": "The wall",
        "title": "Batching and serving",
        "blurb": "Continuous batching and paged memory for the KV cache.",
        "topics": [
            {"label": "Static vs continuous batching (the Orca insight)", "res": [_r("Orca, OSDI 22", "https://www.usenix.org/conference/osdi22/presentation/yu", "paper")]},
            {"label": "PagedAttention and the vLLM anatomy", "res": [_r("vLLM blog", "https://blog.vllm.ai/2023/06/20/vllm.html", "read")]},
            {"label": "Read the vLLM V1 engine source", "res": [_r("vllm-project/vllm", "https://github.com/vllm-project/vllm", "code")]},
            {"label": "Prefix caching and chunked prefill", "res": [_r("vLLM docs", "https://docs.vllm.ai/", "read")]},
        ],
    },
    {
        "alt": "Summit push",
        "title": "Advanced acceleration",
        "blurb": "Speculative decoding, draft heads, and parallelism.",
        "topics": [
            {"label": "Speculative decoding (EAGLE-2)", "res": [_r("arXiv 2406.16858", "https://arxiv.org/abs/2406.16858", "paper")]},
            {"label": "EAGLE / Medusa draft heads", "res": [_r("Medusa 2401.10774", "https://arxiv.org/abs/2401.10774", "paper")]},
            {"label": "CUDA graphs and torch.compile", "res": [_r("PyTorch docs", "https://pytorch.org/docs/stable/notes/cuda.html", "read")]},
            {"label": "Tensor and pipeline parallelism", "res": [], "build": True},
        ],
    },
    {
        "alt": "Summit",
        "title": "Mastery and contribution",
        "blurb": "Trace, benchmark, write a kernel, ship a PR.",
        "topics": [
            {"label": "Trace one real request through vLLM or SGLang", "res": [], "build": True},
            {"label": "Benchmark TTFT, latency, and throughput", "res": [], "build": True},
            {"label": "Write a Triton or CUDA kernel", "res": [], "build": True},
            {"label": "Ship a PR to an open-source inference engine", "res": [], "build": True},
        ],
    },
]

TOTAL_TOPICS = sum(len(s["topics"]) for s in roadmap)


# Quizzes carry the private grading fields (answer/tolerance, tests, keywords/rubric).
# These are never serialized to the client by the content endpoints; grading.py reads
# them server-side and the API returns only the public shape (see schemas.public_quiz).
quizzes: list[dict[str, Any]] = [
    {
        "stage": 0,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "One self-attention head processes a sequence of 10 tokens. How many scalar entries are in the raw score matrix QK^T, before softmax?", "hint": "It is a square matrix over the sequence positions.", "answer": 100, "tolerance": 0, "unit": ""},
            {"type": "code", "weight": "full", "prompt": "Implement a numerically stable softmax over an array of logits. Return an array of probabilities that sums to 1.", "signature": "function softmax(logits) {\n  // return array of probabilities\n}", "entry": "softmax", "tests": [
                {"args": [[0, 0, 0]], "expected": [0.3333333333, 0.3333333333, 0.3333333333]},
                {"args": [[1000, 1000]], "expected": [0.5, 0.5]},
                {"args": [[2, 1, 0]], "expected": [0.6652409558, 0.2447284711, 0.09003057317]},
            ]},
            {"type": "free", "weight": "reduced", "prompt": "In two sentences, why can self-attention relate two distant tokens more directly than a recurrent network?", "rubric": ["Attention has a constant-length path between any two positions", "It attends to all positions in parallel rather than stepping through them", "No information bottleneck accumulating over many recurrent steps"], "keywords": ["parallel", "distance", "all", "direct", "path", "every", "one step", "constant"]},
        ],
    },
    {
        "stage": 1,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "Apply temperature T = 0.5 to logits [2, 1, 0] (divide logits by T, then softmax). What probability does the argmax token get? Answer to two decimals.", "hint": "Lower temperature sharpens the distribution.", "answer": 0.87, "tolerance": 0.01, "unit": ""},
            {"type": "code", "weight": "full", "prompt": "Implement top-k index selection: given an array of logits and integer k, return the indices of the k largest logits in descending order of logit.", "signature": "function topK(logits, k) {\n  // return array of k indices\n}", "entry": "topK", "tests": [
                {"args": [[0.1, 0.9, 0.3, 0.7], 2], "expected": [1, 3]},
                {"args": [[5, 4, 3, 2, 1], 3], "expected": [0, 1, 2]},
                {"args": [[-1, -5, -2], 1], "expected": [0]},
            ]},
            {"type": "free", "weight": "reduced", "prompt": "Why do we use byte-pair encoding instead of splitting on raw words or feeding raw bytes?", "rubric": ["Raw words give an unbounded vocabulary and no handling of unseen words", "Raw bytes make sequences very long and hard to model", "BPE balances vocabulary size against sequence length by merging frequent pairs"], "keywords": ["vocabulary", "sequence length", "unknown", "rare", "merge", "frequent", "subword", "out of vocab"]},
        ],
    },
    {
        "stage": 2,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "A GEMM multiplies A[2048 x 4096] by B[4096 x 4096] in fp16 (2 bytes). FLOPs = 2*M*N*K. Bytes moved = 2*(M*K + K*N + M*N). Compute the arithmetic intensity in FLOPs per byte.", "hint": "Divide total FLOPs by total bytes. It is a round power of two.", "answer": 1024, "tolerance": 2, "unit": "FLOPs/byte"},
            {"type": "code", "weight": "full", "prompt": "Implement kvCacheAppend(cache, k, v) where cache is { keys: [], values: [] }. Push k and v, then return the new number of cached tokens.", "signature": "function kvCacheAppend(cache, k, v) {\n  // mutate cache, return new length\n}", "entry": "kvCacheAppend", "tests": [
                {"args": [{"keys": [], "values": []}, 1, 2], "expected": 1},
                {"args": [{"keys": [9], "values": [9]}, 5, 6], "expected": 2},
            ]},
            {"type": "free", "weight": "reduced", "prompt": "Why is the decode phase memory-bandwidth-bound while prefill is compute-bound?", "rubric": ["Prefill processes many tokens at once as large matrix-matrix multiplies with high reuse", "Decode generates one token at a time, which is matrix-vector work with little reuse", "Decode is dominated by reading weights and the KV cache from memory"], "keywords": ["one token", "matrix-vector", "gemv", "reuse", "bandwidth", "batch", "weights", "read"]},
        ],
    },
    {
        "stage": 3,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "Naive attention materializes the full N x N score matrix. For N = 8192 in fp16 (2 bytes per entry), how many MiB does one score matrix take? (1 MiB = 2^20 bytes.)", "hint": "N squared entries, times 2 bytes, divided by 2^20.", "answer": 128, "tolerance": 1, "unit": "MiB"},
            {"type": "code", "weight": "full", "prompt": "FlashAttention streams softmax with a running maximum. Implement onlineMax(runningMax, blockMax) returning the updated running maximum.", "signature": "function onlineMax(runningMax, blockMax) {\n  // return updated running max\n}", "entry": "onlineMax", "tests": [
                {"args": ["-Infinity", 3], "expected": 3},
                {"args": [5, 2], "expected": 5},
                {"args": [1, 8], "expected": 8},
            ]},
            {"type": "free", "weight": "reduced", "prompt": "What is the core IO-aware idea in FlashAttention that avoids writing the full attention matrix to memory?", "rubric": ["Tile the computation into blocks that fit in fast on-chip SRAM", "Use an online softmax so partial results can be combined without the full matrix", "This trades a little recomputation for far less slow HBM traffic"], "keywords": ["tiling", "tile", "block", "online softmax", "sram", "hbm", "recompute", "fused"]},
        ],
    },
    {
        "stage": 4,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "A 7B-parameter model stored in fp16 (2 bytes per parameter) needs how many GB just for weights? (Use 1 GB = 1e9 bytes.)", "hint": "Parameters times bytes per parameter.", "answer": 14, "tolerance": 0.5, "unit": "GB"},
            {"type": "numeric", "weight": "full", "prompt": "The same 7B model quantized to 4 bits (0.5 bytes per parameter) needs how many GB for weights?", "hint": "Four bits is half a byte.", "answer": 3.5, "tolerance": 0.2, "unit": "GB"},
            {"type": "free", "weight": "reduced", "prompt": "What do GPTQ and AWQ do that naive round-to-nearest quantization does not, to keep accuracy?", "rubric": ["Use calibration data to see real activation statistics", "Protect salient or outlier weights and channels that matter most", "Minimize the output error rather than just the per-weight rounding error"], "keywords": ["outlier", "salient", "calibration", "activation", "per-channel", "error", "important", "scale"]},
        ],
    },
    {
        "stage": 5,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "PagedAttention stores the KV cache in blocks of 16 tokens. A single sequence of 100 tokens needs how many blocks (no sharing)?", "hint": "Round up.", "answer": 7, "tolerance": 0, "unit": "blocks"},
            {"type": "code", "weight": "full", "prompt": "Implement numBlocks(seqLen, blockSize): the number of fixed-size blocks needed to hold seqLen tokens.", "signature": "function numBlocks(seqLen, blockSize) {\n  // return integer count\n}", "entry": "numBlocks", "tests": [
                {"args": [100, 16], "expected": 7},
                {"args": [16, 16], "expected": 1},
                {"args": [1, 16], "expected": 1},
                {"args": [0, 16], "expected": 0},
            ]},
            {"type": "free", "weight": "reduced", "prompt": "Why does continuous (in-flight) batching raise throughput compared to static batching?", "rubric": ["Sequences in a static batch finish at different times, leaving idle slots", "Continuous batching admits new requests as soon as slots free up", "It keeps the hardware busy instead of waiting for the slowest sequence"], "keywords": ["iteration", "different lengths", "finish", "slot", "idle", "padding", "admit", "utilization"]},
        ],
    },
    {
        "stage": 6,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "Speculative decoding drafts 4 tokens per step with constant acceptance probability 0.8. Expected accepted draft tokens = 0.8 + 0.8^2 + 0.8^3 + 0.8^4. Compute to two decimals.", "hint": "Sum the four powers.", "answer": 2.36, "tolerance": 0.02, "unit": "tokens"},
            {"type": "free", "weight": "reduced", "prompt": "Why is speculative decoding lossless, producing the same output distribution as the target model despite using a cheap draft model?", "rubric": ["The target model verifies drafted tokens in one parallel pass", "A rejection-sampling correction accepts or repairs each token", "The accepted sequence matches sampling from the target distribution exactly"], "keywords": ["verify", "rejection", "target", "accept", "correction", "distribution", "parallel", "resample"]},
        ],
    },
    {
        "stage": 7,
        "questions": [
            {"type": "numeric", "weight": "full", "prompt": "A server generates 12,800 output tokens in 6.4 seconds. What is the throughput in tokens per second?", "hint": "Tokens divided by seconds.", "answer": 2000, "tolerance": 5, "unit": "tok/s"},
            {"type": "numeric", "weight": "full", "prompt": "A request has TTFT of 40 ms, then generates 200 tokens at 5 ms per token. What is the total end-to-end latency in ms?", "hint": "Time to first token plus generation time.", "answer": 1040, "tolerance": 5, "unit": "ms"},
            {"type": "free", "weight": "reduced", "prompt": "Name two metrics you would report when benchmarking an inference server, and one way they trade off.", "rubric": ["Latency metrics like TTFT and per-token latency", "Throughput such as total tokens per second across requests", "Larger batches lift throughput but can raise per-request latency"], "keywords": ["ttft", "throughput", "latency", "tokens per second", "batch", "tail", "p99", "concurrency"]},
        ],
    },
]


def quiz_for_stage(stage: int) -> Optional[dict[str, Any]]:
    for q in quizzes:
        if q["stage"] == stage:
            return q
    return None


csTree: dict[str, Any] = {
    "id": "compsci",
    "label": "compsci",
    "children": [
        {"id": "ai", "label": "ai / ml", "children": [
            {"id": "llm-inference", "label": "llm", "climb": "llm-inference"},
            {"id": "deep-learning", "label": "deep learning"},
            {"id": "rl", "label": "reinforcement learning"},
        ]},
        {"id": "systems", "label": "systems", "children": [
            {"id": "os", "label": "operating systems"},
            {"id": "db", "label": "databases"},
            {"id": "net", "label": "networking"},
        ]},
        {"id": "theory", "label": "theory", "children": [
            {"id": "algorithms", "label": "algorithms"},
            {"id": "crypto", "label": "cryptography"},
        ]},
        {"id": "graphics", "label": "graphics", "children": [
            {"id": "gpu", "label": "gpu & rendering"},
        ]},
    ],
}


genres: list[dict[str, Any]] = [
    {"id": "llm-inference", "name": "LLM", "desc": "From backprop to shipping a CUDA kernel. Eight stages, hard clpr quizzes.", "status": "active", "stages": 8, "topics": 32, "href": "/dashboard"},
    {"id": "systems", "name": "Systems Programming", "desc": "Memory, allocators, syscalls, and writing a tiny kernel.", "status": "soon", "stages": 6, "topics": 24},
    {"id": "distributed", "name": "Distributed Systems", "desc": "Consensus, replication, and the CAP tradeoffs, built by hand.", "status": "soon", "stages": 7, "topics": 28},
    {"id": "gpu", "name": "GPU and Graphics", "desc": "Rasterization, shaders, and parallel compute from first principles.", "status": "soon", "stages": 6, "topics": 24},
    {"id": "crypto", "name": "Applied Cryptography", "desc": "Hashes, curves, and protocols. Break them, then build them.", "status": "soon", "stages": 5, "topics": 20},
    {"id": "databases", "name": "Databases from Scratch", "desc": "B-trees, WAL, query planning, and an engine you can query.", "status": "soon", "stages": 6, "topics": 24},
]


friends: list[dict[str, Any]] = [
    {"name": "Wen Jiang", "handle": "wenj", "xp": 4180, "stage": 5, "streak": 21},
    {"name": "Priya Raghavan", "handle": "praghavan", "xp": 3120, "stage": 4, "streak": 12},
    {"name": "Diego Marchetti", "handle": "dmarch", "xp": 2740, "stage": 3, "streak": 3},
    {"name": "Aisha Okonkwo", "handle": "aokonkwo", "xp": 2210, "stage": 3, "streak": 7},
    {"name": "Tomas Halloran", "handle": "thal", "xp": 1890, "stage": 2, "streak": 0},
]


raceTimes: dict[int, list[dict[str, Any]]] = {
    3: [
        {"name": "Wen Jiang", "ms": 512000, "score": 0.94},
        {"name": "Priya Raghavan", "ms": 690000, "score": 0.88},
        {"name": "Diego Marchetti", "ms": 845000, "score": 0.81},
    ],
    2: [
        {"name": "Aisha Okonkwo", "ms": 402000, "score": 0.9},
        {"name": "Wen Jiang", "ms": 431000, "score": 0.97},
        {"name": "Tomas Halloran", "ms": 733000, "score": 0.72},
    ],
}


# --------------------------- worlds, garage, global users ---------------------------

worlds: list[dict[str, Any]] = [
    {"id": "fundamentals", "name": "transformer fundamentals", "camps": [0, 1]},
    {"id": "decode", "name": "decode & memory", "camps": [2]},
    {"id": "kernels", "name": "kernel optimizations", "camps": [3, 4]},
    {"id": "serving", "name": "serving", "camps": [5]},
    {"id": "advanced", "name": "advanced inference", "camps": [6]},
    {"id": "mastery", "name": "mastery & contribution", "camps": [7]},
]

materials: list[dict[str, Any]] = [
    {"id": "steel", "name": "steel"},
    {"id": "bearings", "name": "bearings"},
    {"id": "titanium", "name": "titanium"},
    {"id": "carbon", "name": "carbon fiber"},
]

# Materials granted when a camp's clpr is cleared (index = stage).
camp_materials: list[dict[str, int]] = [
    {"steel": 4},
    {"steel": 5, "bearings": 2},
    {"steel": 5, "bearings": 3},
    {"steel": 5, "bearings": 3, "titanium": 2},
    {"steel": 5, "bearings": 3, "titanium": 3},
    {"bearings": 2, "titanium": 4, "carbon": 2},
    {"titanium": 4, "carbon": 3},
    {"titanium": 3, "carbon": 3},
]

artifacts: list[dict[str, Any]] = [
    {"id": "whiteboard", "name": "Whiteboard", "blurb": "Sketch architectures before you build them.", "req": 0, "cost": {"steel": 3}},
    {"id": "toolwall", "name": "Tool Wall", "blurb": "Every wrench within reach.", "req": 1, "cost": {"steel": 6, "bearings": 2}},
    {"id": "oscilloscope", "name": "Oscilloscope", "blurb": "Profile what actually happens on the wire.", "req": 2, "cost": {"steel": 4, "bearings": 3, "titanium": 1}},
    {"id": "gpurack", "name": "GPU Rack", "blurb": "Racked accelerators, humming under load.", "req": 3, "cost": {"bearings": 2, "titanium": 3}},
    {"id": "printer", "name": "3D Printer", "blurb": "Fabricate custom parts on demand.", "req": 4, "cost": {"steel": 6, "bearings": 3, "titanium": 2}},
    {"id": "serverrack", "name": "Server Rack", "blurb": "Serve at scale from your own bay.", "req": 5, "cost": {"titanium": 4, "carbon": 1}},
    {"id": "robotarm", "name": "Robot Arm", "blurb": "Automate the tedious builds.", "req": 6, "cost": {"titanium": 3, "carbon": 3}},
]

global_users: list[dict[str, Any]] = [
    {"name": "keon_hz", "handle": "keon", "xp": 9840, "stage": 8, "streak": 61},
    {"name": "mira.tsx", "handle": "mira", "xp": 8710, "stage": 7, "streak": 44},
    {"name": "Sef Okafor", "handle": "sef", "xp": 7620, "stage": 7, "streak": 33},
    {"name": "haruki_n", "handle": "haruki", "xp": 6980, "stage": 6, "streak": 19},
    {"name": "cold_start", "handle": "cstart", "xp": 5310, "stage": 6, "streak": 12},
    {"name": "Ada Whitfield", "handle": "adaw", "xp": 4720, "stage": 5, "streak": 8},
    {"name": "Wen Jiang", "handle": "wenj", "xp": 4180, "stage": 5, "streak": 21},
    {"name": "grokz", "handle": "grokz", "xp": 3640, "stage": 4, "streak": 5},
    {"name": "Priya Raghavan", "handle": "praghavan", "xp": 3120, "stage": 4, "streak": 12},
    {"name": "n_dietrich", "handle": "ndiet", "xp": 2455, "stage": 3, "streak": 0},
    {"name": "Diego Marchetti", "handle": "dmarch", "xp": 2740, "stage": 3, "streak": 3},
    {"name": "kv_cache", "handle": "kvc", "xp": 1980, "stage": 2, "streak": 7},
    {"name": "Tomas Halloran", "handle": "thal", "xp": 1890, "stage": 2, "streak": 0},
    {"name": "seed_0x1f", "handle": "seed", "xp": 940, "stage": 1, "streak": 2},
]

ARTIFACTS_BY_ID: dict[str, dict[str, Any]] = {a["id"]: a for a in artifacts}


TRACK_NAMES: dict[str, str] = {"llm-inference": "llm"}


def get_track(topic_id: str) -> dict[str, Any]:
    """Port of lib/track.ts getTrack: camps + a 16-week plan over the 8 stages."""
    camps = roadmap
    weeks: list[dict[str, Any]] = []
    for w in range(len(camps) * 2):
        camp_id = w // 2
        half = w % 2
        camp = camps[camp_id]
        idx = [half * 2, half * 2 + 1]
        topics = [{
            "stage": camp_id,
            "topic": t,
            "label": camp["topics"][t]["label"],
            "res": camp["topics"][t].get("res", []),
            "build": camp["topics"][t].get("build"),
        } for t in idx]
        weeks.append({
            "index": w,
            "weekNo": w + 1,
            "campId": camp_id,
            "campAlt": camp["alt"],
            "campTitle": camp["title"],
            "topics": topics,
            "campFinalWeek": half == 1,
            "hasQuiz": any(q["stage"] == camp_id for q in quizzes),
        })
    return {
        "id": topic_id,
        "name": TRACK_NAMES.get(topic_id, topic_id),
        "camps": camps,
        "weeks": weeks,
    }
