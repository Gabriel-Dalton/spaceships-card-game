"""Spaceships, played by machines.

A batched engine (``engine``), some ships to sit at the table (``policies``), a
self-play trainer (``train``) and a round-robin to score them (``arena``).
"""

from .engine import Spaceships, play  # noqa: F401
