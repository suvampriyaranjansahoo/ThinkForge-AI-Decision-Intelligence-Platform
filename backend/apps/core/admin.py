from django.contrib import admin
from .models import Organization,Membership,Workspace,Decision,Evidence,Experiment,Document,Chunk,AgentRun,AgentStep,AgentToolCall,AgentFeedback,AuditEvent
for model in [Organization,Membership,Workspace,Decision,Evidence,Experiment,Document,Chunk,AgentRun,AgentStep,AgentToolCall,AgentFeedback,AuditEvent]: admin.site.register(model)
