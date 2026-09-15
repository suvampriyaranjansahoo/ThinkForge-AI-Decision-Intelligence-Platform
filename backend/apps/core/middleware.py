import logging
import time
import uuid

logger = logging.getLogger('thinkforge.api')

class RequestObservabilityMiddleware:
    """Adds a safe correlation ID and latency log without recording request bodies."""
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        started = time.monotonic()
        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        logger.info('api_request request_id=%s method=%s path=%s status=%s duration_ms=%s', request_id, request.method, request.path, response.status_code, round((time.monotonic() - started) * 1000))
        return response
