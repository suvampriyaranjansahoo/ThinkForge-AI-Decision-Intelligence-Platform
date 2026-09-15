from rest_framework.permissions import BasePermission
RANK={'viewer':0,'reviewer':1,'editor':2,'admin':3,'owner':4}
def membership(user,organization):
    from .models import Membership
    return Membership.objects.filter(user=user,organization=organization).first()
def member_for(user, organization):
    return membership(user, organization)
def require_role(user,organization,minimum='viewer'):
    item=membership(user,organization)
    if not item or RANK[item.role]<RANK[minimum]: raise PermissionError(f'{minimum} role required')
    return item
class OrganizationMember(BasePermission):
    def has_object_permission(self,request,view,obj): return bool(membership(request.user,obj.organization if hasattr(obj,'organization') else obj))
