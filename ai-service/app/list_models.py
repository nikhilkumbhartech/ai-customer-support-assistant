from app.services.llm_service import get_client

for m in get_client().models.list():
    print(m.name)