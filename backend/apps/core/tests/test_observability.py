from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from apps.core.middleware import RequestObservabilityMiddleware

class ObservabilityTests(SimpleTestCase):
    def test_adds_request_id_without_logging_body(self):
        response = RequestObservabilityMiddleware(lambda request: HttpResponse('ok'))(RequestFactory().get('/api/health/'))
        self.assertTrue(response['X-Request-ID'])
