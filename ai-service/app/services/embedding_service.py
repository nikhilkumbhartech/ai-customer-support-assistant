_model = None


def get_model():
    # Heavy import yahin hota hai, taaki server jaldi start ho.
    # Model sirf pehli baar load hota hai, phir memory mein rehta hai.
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _model


def embed_texts(texts: list[str]):
    # normalize_embeddings=True: cosine search sahi chalta hai
    return get_model().encode(texts, normalize_embeddings=True, batch_size=32)
