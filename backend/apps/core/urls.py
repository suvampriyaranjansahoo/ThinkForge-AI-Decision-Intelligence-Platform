from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health),
    path('organizations/', views.OrganizationList.as_view()),
    path('organizations/<uuid:organization_id>/members/', views.MembershipList.as_view()),
    path('decisions/', views.DecisionList.as_view()),
    path('decisions/<uuid:pk>/', views.DecisionDetail.as_view()),
    path('decisions/<uuid:decision_id>/evidence/', views.EvidenceList.as_view()),
    path('decisions/<uuid:decision_id>/experiments/', views.ExperimentList.as_view()),
    path('rag/', views.rag),
    path('agent/', views.agent),
    path('agent/<uuid:run_id>/feedback/', views.agent_feedback),
    path('agent/<uuid:run_id>/review/assign/', views.agent_review_assign),
    path('agent/<uuid:run_id>/review/resolve/', views.agent_review_resolve),
    path('workspace/', views.workspace),
    path('ai/', views.ai),
]
