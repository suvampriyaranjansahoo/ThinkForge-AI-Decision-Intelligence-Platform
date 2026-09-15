"""Tenant-scoped hybrid retrieval with citation-ready output."""
from django.db import connection
from django.db.models import Q
from .models import Chunk
from .providers import ProviderUnavailable, embeddings

def search(*, organization, query, limit=8):
    query = (query or '').strip()
    if not query: return [], {'mode': 'empty', 'embeddingUsed': False}
    terms = [term for term in query.split() if len(term) > 2][:12]
    lexical = Chunk.objects.filter(organization=organization).filter(
        Q(content__icontains=query) | Q(content__icontains=terms[0] if terms else query)
    ).select_related('document')
    vector_rows, vector_used = [], False
    if connection.vendor == 'postgresql':
        try:
            from pgvector.django import CosineDistance
            vector = embeddings([query], organization=organization)[0]
            vector_rows = list(Chunk.objects.filter(organization=organization, embedding__isnull=False)
                               .select_related('document').annotate(distance=CosineDistance('embedding', vector))[:limit * 2])
            vector_used = True
        except ProviderUnavailable:
            pass
    # Reciprocal-rank fusion: combines lexical and vector candidate ranks.
    scores, rows = {}, {}
    for candidates in (list(lexical[:limit * 2]), vector_rows):
        for rank, row in enumerate(candidates, start=1):
            key = str(row.id); rows[key] = row; scores[key] = scores.get(key, 0) + 1 / (60 + rank)
    ordered = sorted(rows, key=lambda key: scores[key], reverse=True)[:limit]
    return [
        {'id': key, 'documentId': str(rows[key].document_id), 'docName': rows[key].document.name,
         'text': rows[key].content, 'meta': f'chunk {rows[key].chunk_index + 1}',
         'score': round(scores[key], 5), 'citation': {'document': rows[key].document.name, 'chunkIndex': rows[key].chunk_index}}
        for key in ordered
    ], {'mode': 'hybrid_rrf' if vector_used else 'lexical_fallback', 'embeddingUsed': vector_used}
