"""
WebSocket consumer for real-time report generation progress.

Authentication: JWT via Sec-WebSocket-Protocol header (same pattern as ChatConsumer).

The consumer joins the Redis channel group `report_<job_id>` and forwards
every message pushed by the Celery worker to the connected browser client.

Incoming WS message: none expected (read-only progress stream).

Outgoing message types:
  {"type": "progress",      "percent": 5,  "message": "..."}
  {"type": "agenda_progress", "agenda_id": "...", "order": 0, "message": "..."}
  {"type": "agenda_done",   "agenda_id": "...", "order": 0,
                             "sub_report": "...", "sources": [...], "percent": 40}
  {"type": "report_done",   "job_id": "...", "final_report": "...", "percent": 100}
  {"type": "error",         "message": "..."}
"""
from __future__ import annotations

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


class ReportProgressConsumer(AsyncWebsocketConsumer):
    """Forwards Celery task progress events to the browser over WebSocket."""

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self) -> None:
        # Validate JWT from Sec-WebSocket-Protocol subprotocol header
        subprotocols: list[str] = self.scope.get("subprotocols", [])
        token_str: str | None = None

        if len(subprotocols) >= 2 and subprotocols[0] == "access_token":
            token_str = subprotocols[1]

        if not token_str:
            logger.warning("ReportProgressConsumer: no token — rejecting")
            await self.close(code=4001)
            return

        try:
            token = AccessToken(token_str)
            self.user_id: int = int(token.payload.get("user_id", 0))
        except TokenError as exc:
            logger.warning("ReportProgressConsumer: invalid JWT — %s", exc)
            await self.close(code=4001)
            return

        if not self.user_id:
            await self.close(code=4001)
            return

        # Extract job_id from the URL route kwargs
        self.job_id: str = self.scope["url_route"]["kwargs"]["job_id"]
        self.group_name: str = f"report_{self.job_id}"

        # Verify the job belongs to the requesting user
        from asgiref.sync import sync_to_async
        job_ok = await sync_to_async(self._job_belongs_to_user)(self.job_id, self.user_id)
        if not job_ok:
            logger.warning(
                "ReportProgressConsumer: job %s not found or access denied for user %s",
                self.job_id, self.user_id,
            )
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol="access_token")

        logger.info(
            "ReportProgressConsumer connected job=%s user=%s",
            self.job_id, self.user_id,
        )

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.debug("ReportProgressConsumer disconnected code=%s", close_code)

    # ------------------------------------------------------------------
    # Channel-layer message handler
    # ------------------------------------------------------------------

    async def report_progress(self, event: dict) -> None:
        """
        Forward a channel-layer message to the WebSocket client.

        The Celery task sends events with type="report.progress" which
        Django Channels converts to this handler name (dots → underscores).
        """
        # Build the client-facing payload — strip the internal 'type' key
        payload = {k: v for k, v in event.items() if k != "type"}
        # Rename event_type → type for the client protocol
        payload["type"] = event.get("event_type", "progress")
        await self.send(text_data=json.dumps(payload))

    # ------------------------------------------------------------------
    # DB helper
    # ------------------------------------------------------------------

    def _job_belongs_to_user(self, job_id: str, user_id: int) -> bool:
        from .models import ReportJob  # noqa: PLC0415
        try:
            ReportJob.objects.get(id=job_id, user_id=user_id)
            return True
        except ReportJob.DoesNotExist:
            return False
