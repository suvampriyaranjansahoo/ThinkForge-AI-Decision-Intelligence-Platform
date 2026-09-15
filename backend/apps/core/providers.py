"""Server-side, OpenAI-compatible provider adapters.

No key is ever accepted from the browser. Embeddings are opt-in because each
call can incur cost and may send document text to a configured provider.
"""
import json
from urllib import request as urlrequest
from django.conf import settings
from .privacy import redact_for_external_call

class ProviderUnavailable(RuntimeError): pass

def embeddings(texts, *, organization=None):
    if organization is not None and not organization.external_data_sharing_enabled:
        raise ProviderUnavailable('External data sharing is disabled for this organization.')
    if not settings.AI_EMBEDDING_ENABLED:
        raise ProviderUnavailable('Embeddings are disabled by configuration.')
    if not settings.AI_API_KEY:
        raise ProviderUnavailable('AI_API_KEY is not configured.')
    redacted_texts = []
    for t in texts:
        red, _counts = redact_for_external_call(t)
        redacted_texts.append(red)
    payload = json.dumps({'model': settings.AI_EMBEDDING_MODEL, 'input': redacted_texts}).encode()
    req = urlrequest.Request(
        settings.AI_BASE_URL.rstrip('/') + '/embeddings', data=payload,
        headers={'Authorization': f'Bearer {settings.AI_API_KEY}', 'Content-Type': 'application/json'}, method='POST'
    )
    try:
        with urlrequest.urlopen(req, timeout=settings.AI_REQUEST_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read())
    except Exception as exc:
        raise ProviderUnavailable(f'Embedding provider unavailable: {exc}') from exc
    vectors = [item['embedding'] for item in sorted(data.get('data', []), key=lambda item: item['index'])]
    if len(vectors) != len(texts): raise ProviderUnavailable('Embedding provider returned an incomplete response.')
    if any(len(vector) != 1536 for vector in vectors): raise ProviderUnavailable('Expected 1536-dimension embeddings.')
    return vectors
