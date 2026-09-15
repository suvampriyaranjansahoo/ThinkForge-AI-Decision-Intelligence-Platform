from django.contrib import admin
from django.urls import include,path
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView
urlpatterns=[path('admin/',admin.site.urls),path('api/auth/token/',TokenObtainPairView.as_view()),path('api/auth/refresh/',TokenRefreshView.as_view()),path('api/',include('apps.core.urls'))]
