import os
import sys
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent.parent
SECRET_KEY=os.getenv('DJANGO_SECRET_KEY','unsafe-development-only-change-me')
DEBUG=os.getenv('DJANGO_DEBUG','true').lower()=='true'
ALLOWED_HOSTS=[x for x in os.getenv('DJANGO_ALLOWED_HOSTS','localhost,127.0.0.1').split(',') if x]
INSTALLED_APPS=['django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','corsheaders','rest_framework','rest_framework_simplejwt','apps.core']
MIDDLEWARE=['corsheaders.middleware.CorsMiddleware','django.middleware.security.SecurityMiddleware','apps.core.middleware.RequestObservabilityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF='config.urls'
TEMPLATES=[{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION='config.wsgi.application'
if 'test' in sys.argv:
    # Fast isolated test database; the production path below remains PostgreSQL/pgvector.
    DATABASES={'default':{'ENGINE':'django.db.backends.sqlite3','NAME':':memory:'}}
else:
    DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.getenv('POSTGRES_DB','thinkforge'),'USER':os.getenv('POSTGRES_USER','thinkforge'),'PASSWORD':os.getenv('POSTGRES_PASSWORD','thinkforge'),'HOST':os.getenv('POSTGRES_HOST','localhost'),'PORT':os.getenv('POSTGRES_PORT','5432')}}
AUTH_PASSWORD_VALIDATORS=[]
LANGUAGE_CODE='en-us';TIME_ZONE='UTC';USE_I18N=True;USE_TZ=True
STATIC_URL='static/';DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS=[x for x in os.getenv('CORS_ALLOWED_ORIGINS','http://localhost:3000,http://localhost:5173').split(',') if x]
REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework_simplejwt.authentication.JWTAuthentication'],'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],'DEFAULT_RENDERER_CLASSES':['rest_framework.renderers.JSONRenderer'],'DEFAULT_THROTTLE_CLASSES':['rest_framework.throttling.AnonRateThrottle','rest_framework.throttling.UserRateThrottle'],'DEFAULT_THROTTLE_RATES':{'anon':'60/minute','user':'240/minute'}}
LOGGING={'version':1,'disable_existing_loggers':False,'handlers':{'console':{'class':'logging.StreamHandler'}},'loggers':{'thinkforge.api':{'handlers':['console'],'level':os.getenv('LOG_LEVEL','INFO'),'propagate':False}}}
CELERY_BROKER_URL=os.getenv('CELERY_BROKER_URL','redis://localhost:6379/0');CELERY_RESULT_BACKEND=os.getenv('CELERY_RESULT_BACKEND','redis://localhost:6379/1')
AI_API_KEY=os.getenv('AI_API_KEY','');AI_BASE_URL=os.getenv('AI_BASE_URL','https://api.openai.com/v1');AI_MODEL=os.getenv('AI_MODEL','gpt-4o-mini')
AI_EMBEDDING_ENABLED=os.getenv('AI_EMBEDDING_ENABLED','false').lower()=='true';AI_EMBEDDING_MODEL=os.getenv('AI_EMBEDDING_MODEL','text-embedding-3-small');AI_REQUEST_TIMEOUT_SECONDS=int(os.getenv('AI_REQUEST_TIMEOUT_SECONDS','20'))
