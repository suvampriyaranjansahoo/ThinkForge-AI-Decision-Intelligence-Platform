from rest_framework import serializers
from .models import Organization,Membership,Decision,Evidence,Experiment,Document,Chunk,AgentRun,AgentStep,AgentToolCall,AgentFeedback
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta: model=Organization;fields=['id','name','created_by','created_at'];read_only_fields=['id','created_by','created_at']
class DecisionSerializer(serializers.ModelSerializer):
    class Meta: model=Decision;fields='__all__';read_only_fields=['id','organization','created_by','version','created_at','updated_at']
class EvidenceSerializer(serializers.ModelSerializer):
    class Meta: model=Evidence;fields='__all__';read_only_fields=['id','organization','created_at']
class ExperimentSerializer(serializers.ModelSerializer):
    class Meta: model=Experiment;fields='__all__';read_only_fields=['id','organization','created_at','updated_at']
class DocumentSerializer(serializers.ModelSerializer):
    class Meta: model=Document;fields='__all__';read_only_fields=['id','organization','uploaded_by','created_at']
class ChunkSerializer(serializers.ModelSerializer):
    class Meta: model=Chunk;fields=['id','document','chunk_index','content','metadata']
class AgentStepSerializer(serializers.ModelSerializer):
    class Meta: model=AgentStep;fields=['sequence_no','state','event_type','detail','created_at']
class AgentToolSerializer(serializers.ModelSerializer):
    class Meta: model=AgentToolCall;fields=['tool_name','status','attempt','latency_ms','cost_usd','error_code','created_at']
class AgentRunSerializer(serializers.ModelSerializer):
    steps=AgentStepSerializer(many=True,read_only=True);tool_calls=AgentToolSerializer(many=True,read_only=True)
    class Meta: model=AgentRun;fields=['id','organization','decision','state','agent_version','goal','plan','metrics','reviewer','review_assigned_at','review_due_at','reviewed_at','review_outcome','created_at','updated_at','steps','tool_calls'];read_only_fields=['id','organization','state','agent_version','plan','metrics','reviewer','review_assigned_at','review_due_at','reviewed_at','review_outcome','created_at','updated_at']
class AgentFeedbackSerializer(serializers.ModelSerializer):
    class Meta: model=AgentFeedback;fields=['id','run','rating','outcome','note','created_at'];read_only_fields=['id','run','created_at']
