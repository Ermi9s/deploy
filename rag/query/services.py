from __future__ import annotations

from django.conf import settings

from .clients import get_es_client, get_genai_client


def embed_query(question: str) -> list[float]:
    """Embed the user question using the same Gemini model used at ingestion time."""
    client = get_genai_client()
    response = client.models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        contents=question,
    )
    # Parse the embedding vector from the response
    embeddings = getattr(response, 'embeddings', None)
    if embeddings and len(embeddings) > 0:
        values = getattr(embeddings[0], 'values', None)
        if values is not None:
            return [float(v) for v in values]
    raise ValueError('Failed to generate embedding for the query.')


def retrieve_chunks(query_vector: list[float], top_k: int | None = None) -> list[dict]:
    """Perform a k-NN search against the Elasticsearch documents_chunks index."""
    es = get_es_client()
    k = top_k or settings.RAG_TOP_K

    body = {
        'knn': {
            'field': 'embedding',
            'query_vector': query_vector,
            'k': k,
            'num_candidates': k * 10,
        },
        '_source': ['document_id', 'chunk_id', 'text', 'filename', 'source_type'],
        'size': k,
    }

    response = es.search(index=settings.ELASTICSEARCH_INDEX, body=body)

    chunks = []
    for hit in response['hits']['hits']:
        source = hit['_source']
        chunks.append({
            'chunk_id': source.get('chunk_id', hit['_id']),
            'document_id': source.get('document_id', ''),
            'filename': source.get('filename', ''),
            'text': source.get('text', ''),
            'score': hit['_score'],
        })
    return chunks


def build_rag_prompt(question: str, chunks: list[dict]) -> str:
    """Construct the augmented prompt for the generative model."""
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        context_parts.append(
            f'--- Source {i} (file: {chunk["filename"]}) ---\n{chunk["text"]}'
        )

    context_block = '\n\n'.join(context_parts)

    return (
        'You are an expert assistant for an organizational knowledge management system. '
        'Answer the user\'s question using ONLY the context provided below. '
        'If the context does not contain enough information, say so clearly.\n\n'
        f'### Context\n{context_block}\n\n'
        f'### Question\n{question}\n\n'
        '### Answer'
    )


def generate_answer(prompt: str) -> str:
    """Call the Gemini generative model with the augmented prompt."""
    client = get_genai_client()
    response = client.models.generate_content(
        model=settings.GEMINI_GENERATIVE_MODEL,
        contents=prompt,
    )
    return response.text
