from rest_framework import serializers


class QueryRequestSerializer(serializers.Serializer):
    question = serializers.CharField(
        max_length=2000,
        help_text='The user question to answer using the knowledge base.',
    )
    top_k = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=20,
        help_text='Number of relevant chunks to retrieve (default from settings).',
    )


class SourceChunkSerializer(serializers.Serializer):
    chunk_id = serializers.CharField()
    document_id = serializers.CharField()
    filename = serializers.CharField()
    text = serializers.CharField()
    score = serializers.FloatField()


class QueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    sources = SourceChunkSerializer(many=True)
