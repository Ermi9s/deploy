from __future__ import annotations

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self) -> None:
        subprotocols: list[str] = self.scope.get('subprotocols', [])
        token_str: str | None = None

        if len(subprotocols) >= 2 and subprotocols[0] == 'access_token':
            token_str = subprotocols[1]

        if not token_str:
            logger.warning('Notification WS rejected: no token in subprotocols')
            await self.close(code=4001)
            return

        try:
            token = AccessToken(token_str)
            self.user_id: int = int(token.payload.get('user_id', 0))
        except TokenError as exc:
            logger.warning('Notification WS rejected: invalid JWT: %s', exc)
            await self.close(code=4001)
            return

        if not self.user_id:
            logger.warning('Notification WS rejected: user_id missing from token')
            await self.close(code=4001)
            return

        self.group_name = f'notif_user_{self.user_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol='access_token')

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.debug('Notification WS disconnected: %s', close_code)

    async def notification_message(self, event: dict) -> None:
        await self.send(text_data=json.dumps(event['data']))
