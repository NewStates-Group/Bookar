from django.conf import settings
from django.http import JsonResponse


def handler400(request, exception=None):
    resp = {"msg": "Bad request"}
    if settings.DEBUG:
        resp["detail"] = str(exception)
    return JsonResponse(resp, status=400)


def handler403(request, exception=None):
    resp = {"msg": "Forbidden"}
    if settings.DEBUG:
        resp["detail"] = str(exception)
    return JsonResponse(resp, status=403)


def handler404(request, exception=None):
    resp = {"msg": "Page not found"}
    if settings.DEBUG:
        resp["detail"] = str(exception)
    return JsonResponse(resp, status=404)


def handler500(request, exception=None):
    resp = {"msg": "Internal error"}
    if settings.DEBUG:
        resp["detail"] = str(exception)
    return JsonResponse(resp, status=500)
