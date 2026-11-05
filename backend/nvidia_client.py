"""Client for NVIDIA's OpenAI-compatible chat-completions API."""
from __future__ import annotations

import json
from typing import AsyncGenerator, Generator, List

import httpx

from . import config


class NVIDIAError(RuntimeError):
    """Raised when NVIDIA NIM is unavailable or returns an invalid response."""


def _client() -> httpx.Client:
    return httpx.Client(
        timeout=config.HTTP_TIMEOUT,
        headers={
            "Authorization": f"Bearer {config.NVIDIA_API_KEY}",
            "Accept": "application/json",
        },
    )


def _async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=config.HTTP_TIMEOUT,
        headers={
            "Authorization": f"Bearer {config.NVIDIA_API_KEY}",
            "Accept": "application/json",
        },
    )


def _require_api_key() -> None:
    if not config.NVIDIA_API_KEY:
        raise NVIDIAError("NVIDIA_API_KEY is not configured on the server.")


def health() -> dict:
    """Return NVIDIA API availability for the UI status pill."""
    if not config.NVIDIA_API_KEY:
        return {
            "online": False,
            "provider": "NVIDIA NIM",
            "chat_model": config.CHAT_MODEL,
            "error": "NVIDIA_API_KEY is not configured.",
        }

    api_base_url = config.NVIDIA_API_URL.rsplit("/", 2)[0]
    models_url = api_base_url + "/models"
    try:
        with _client() as client:
            response = client.get(models_url)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
                raise ValueError("NVIDIA returned an unexpected model-list response.")
    except (httpx.HTTPError, ValueError) as exc:
        return {
            "online": False,
            "provider": "NVIDIA NIM",
            "chat_model": config.CHAT_MODEL,
            "error": str(exc),
        }
    return {
        "online": True,
        "provider": "NVIDIA NIM",
        "chat_model": config.CHAT_MODEL,
    }


def _payload(messages: List[dict], stream: bool, json_mode: bool = False) -> dict:
    payload = {
        "model": config.CHAT_MODEL,
        "messages": messages,
        "max_tokens": 2048 if json_mode else config.CHAT_MAX_TOKENS,
        "seed": 0,
        "stream": stream,
        "temperature": 0.0 if json_mode else config.CHAT_TEMPERATURE,
        "top_p": 1.0 if json_mode else config.CHAT_TOP_P,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    return payload


def chat_stream(messages: List[dict]) -> Generator[str, None, None]:
    """Yield incremental assistant text from an SSE chat-completions response."""
    _require_api_key()
    payload = _payload(messages, stream=True)
    try:
        with _client() as client:
            with client.stream(
                "POST",
                config.NVIDIA_API_URL,
                json=payload,
                headers={"Accept": "text/event-stream"},
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError as exc:
                        raise NVIDIAError("NVIDIA returned malformed streaming data.") from exc
                    if not isinstance(chunk, dict):
                        raise NVIDIAError("NVIDIA returned an unexpected streaming response.")
                    if chunk.get("error"):
                        raise NVIDIAError(f"NVIDIA chat request failed: {chunk['error']}")
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0].get("delta") or {}).get("content")
                    if isinstance(delta, str) and delta:
                        yield delta
    except httpx.HTTPError as exc:
        raise NVIDIAError(f"NVIDIA chat streaming failed: {exc}") from exc


async def chat_stream_async(messages: List[dict]) -> AsyncGenerator[str, None]:
    """Yield streamed response text and close the upstream request on cancellation."""
    _require_api_key()
    payload = _payload(messages, stream=True)
    try:
        async with _async_client() as client:
            async with client.stream(
                "POST",
                config.NVIDIA_API_URL,
                json=payload,
                headers={"Accept": "text/event-stream"},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError as exc:
                        raise NVIDIAError("NVIDIA returned malformed streaming data.") from exc
                    if not isinstance(chunk, dict):
                        raise NVIDIAError("NVIDIA returned an unexpected streaming response.")
                    if chunk.get("error"):
                        raise NVIDIAError(f"NVIDIA chat request failed: {chunk['error']}")
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0].get("delta") or {}).get("content")
                    if isinstance(delta, str) and delta:
                        yield delta
    except httpx.HTTPError as exc:
        raise NVIDIAError(f"NVIDIA chat streaming failed: {exc}") from exc


def chat_once(messages: List[dict], json_mode: bool = False) -> str:
    """Return a single NVIDIA chat-completions response."""
    _require_api_key()
    payload = _payload(messages, stream=False, json_mode=json_mode)
    try:
        with _client() as client:
            response = client.post(config.NVIDIA_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NVIDIAError(f"NVIDIA chat request failed: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise NVIDIAError("NVIDIA returned an unexpected chat-completions response.") from exc
    if not isinstance(content, str):
        raise NVIDIAError("NVIDIA returned non-text content for a text chat request.")
    return content


async def chat_once_async(messages: List[dict], json_mode: bool = False) -> str:
    """Return one NVIDIA response without blocking the async lesson stream."""
    _require_api_key()
    payload = _payload(messages, stream=False, json_mode=json_mode)
    try:
        async with _async_client() as client:
            response = await client.post(config.NVIDIA_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NVIDIAError(f"NVIDIA chat request failed: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise NVIDIAError("NVIDIA returned an unexpected chat-completions response.") from exc
    if not isinstance(content, str):
        raise NVIDIAError("NVIDIA returned non-text content for a text chat request.")
    return content
