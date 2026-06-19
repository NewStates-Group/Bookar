from asgiref.sync import sync_to_async
from django.db import models


def _queryset_to_list(qs):
    return list(qs)


class AsyncORM:
    @staticmethod
    def get(model, **kwargs):
        return sync_to_async(model.objects.get)(**kwargs)

    @staticmethod
    def filter(model, **kwargs):
        return sync_to_async(lambda: list(model.objects.filter(**kwargs)))()

    @staticmethod
    def filter_qs(qs):
        return sync_to_async(_queryset_to_list)(qs)

    @staticmethod
    def create(model, **kwargs):
        return sync_to_async(model.objects.create)(**kwargs)

    @staticmethod
    def save(instance, update_fields=None):
        if update_fields:
            return sync_to_async(instance.save)(update_fields=update_fields)
        return sync_to_async(instance.save)()

    @staticmethod
    def delete(instance):
        return sync_to_async(instance.delete)()

    @staticmethod
    def exists(model, **kwargs):
        return sync_to_async(model.objects.filter(**kwargs).exists)()

    @staticmethod
    def count(qs):
        return sync_to_async(qs.count)()

    @staticmethod
    def first(model, **kwargs):
        return sync_to_async(model.objects.filter(**kwargs).first)()

    @staticmethod
    def update(model, filter_kwargs, update_kwargs):
        return sync_to_async(
            lambda: model.objects.filter(**filter_kwargs).update(**update_kwargs)
        )()

    @staticmethod
    def get_or_create(model, defaults=None, **kwargs):
        return sync_to_async(model.objects.get_or_create)(defaults=defaults, **kwargs)

    @staticmethod
    def update_or_create(model, defaults=None, **kwargs):
        return sync_to_async(model.objects.update_or_create)(
            defaults=defaults, **kwargs
        )

    @staticmethod
    def delete_filter(model, **kwargs):
        return sync_to_async(
            lambda: model.objects.filter(**kwargs).delete()
        )()

    @staticmethod
    def values_list(qs, *fields, flat=False):
        return sync_to_async(
            lambda: list(qs.values_list(*fields, flat=flat))
        )()

    @staticmethod
    def aggregate(qs, **kwargs):
        return sync_to_async(qs.aggregate)(**kwargs)

    @staticmethod
    def select_related(model, related, **kwargs):
        return sync_to_async(model.objects.select_related(related).get)(**kwargs)

    @staticmethod
    def prefetch_related(model, prefetch, **kwargs):
        return sync_to_async(
            lambda: model.objects.prefetch_related(prefetch).filter(**kwargs)
        )()

    @staticmethod
    def bulk_create(model, objs):
        return sync_to_async(model.objects.bulk_create)(objs)
