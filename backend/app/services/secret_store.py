from __future__ import annotations

from typing import Protocol


class SecretStore(Protocol):
    def store(self, value: str) -> str:
        ...

    def reveal(self, value: str) -> str:
        ...


class PlaintextSecretStore:
    def store(self, value: str) -> str:
        return value.strip()

    def reveal(self, value: str) -> str:
        return value

