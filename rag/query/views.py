import logging

from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import QueryRequestSerializer, QueryResponseSerializer
from .services import embed_query, retrieve_chunks, build_rag_prompt, generate_answer

logger = logging.getLogger(__name__)


class QueryAPIView(APIView):
    @extend_schema(
        summary='Ask a question',
        description='Submit a natural-language question. The system retrieves '
                    'relevant document chunks and generates an answer.',
        request=QueryRequestSerializer,
        responses={
            200: QueryResponseSerializer,
            400: OpenApiResponse(description='Invalid request'),
            500: OpenApiResponse(description='Internal pipeline error'),
        },
    )
    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        top_k = serializer.validated_data.get('top_k')

        try:
            # 1: Embed the user query
            query_vector = embed_query(question)

            # 2: Retrieve relevant chunks from Elasticsearch
            chunks = retrieve_chunks(query_vector, top_k=top_k)

            if not chunks:
                return Response(
                    QueryResponseSerializer({
                        'answer': 'No relevant documents found in the knowledge base.',
                        'sources': [],
                    }).data,
                    status=status.HTTP_200_OK,
                )

            # 3: Build the augmented prompt
            prompt = build_rag_prompt(question, chunks)

            # 4: Generate the answer
            answer = generate_answer(prompt)

            # 5: Return formatted response
            return Response(
                QueryResponseSerializer({
                    'answer': answer,
                    'sources': chunks,
                }).data,
                status=status.HTTP_200_OK,
            )

        except Exception:
            logger.exception('RAG pipeline failed for question: %s', question)
            return Response(
                {'error': 'An internal error occurred while processing your question.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
