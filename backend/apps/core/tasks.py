from celery import shared_task
from django.db import transaction
from .models import Chunk, Document
from .providers import ProviderUnavailable, embeddings

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def index_document(self, document_id, text):
    """Chunk text and, only when explicitly enabled, create provider embeddings."""
    with transaction.atomic():
        document = Document.objects.select_for_update().get(pk=document_id)
        Chunk.objects.filter(document=document).delete()
        normalized = ' '.join((text or '').split())
        parts = [normalized[i:i + 1200] for i in range(0, len(normalized), 1200)]
        Chunk.objects.bulk_create([
            Chunk(document=document, organization=document.organization, chunk_index=i,
                  content=part, metadata={'embeddingStatus': 'pending_provider'})
            for i, part in enumerate(parts) if part
        ])
        chunks = list(Chunk.objects.filter(document=document).order_by('chunk_index'))
    try:
        vectors = embeddings([chunk.content for chunk in chunks], organization=document.organization)
        for chunk, vector in zip(chunks, vectors):
            chunk.embedding = vector; chunk.metadata = {**chunk.metadata, 'embeddingStatus': 'ready'}
        Chunk.objects.bulk_update(chunks, ['embedding', 'metadata'])
        status = 'ready'
    except ProviderUnavailable as exc:
        Chunk.objects.filter(pk__in=[chunk.pk for chunk in chunks]).update(metadata={'embeddingStatus': 'not_configured', 'reason': str(exc)})
        status = 'lexical_only'
    return {'documentId': str(document_id), 'chunks': len(parts), 'embeddingStatus': status}
