from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np
from catboost import CatBoostClassifier
import os

app = FastAPI(title="Oil Isotope ML API")

# Base directory for model files and frontend build
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# CORS (на случай dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# загрузка заранее обученных моделей (обучение моделей в файле models.ipynb)
organic_matter_model_kerogen = CatBoostClassifier()
organic_matter_model_oil_bitumoid = CatBoostClassifier()
thermal_alteration_model = CatBoostClassifier()
oxidation_model = CatBoostClassifier()


organic_matter_model_kerogen.load_model(
    os.path.join(BASE_DIR, "catboost_multiclass_organic_matter_kerogen.cbm")
)
organic_matter_model_oil_bitumoid.load_model(
    os.path.join(BASE_DIR, "catboost_multiclass_organic_matter_oil_bitumoid.cbm")
)
thermal_alteration_model.load_model(
    os.path.join(BASE_DIR, "catboost_thermal_alteration_knn_imputer.cbm")
)
oxidation_model.load_model(
    os.path.join(BASE_DIR, "catboost_oxidation_no_imputer.cbm")
)


class PredictionRequest(BaseModel):
    sample_type: str = Field(
        ..., description="Введите тип образца: 'нефть' или 'битумоид' или 'кероген")
    measurements: List[float] = Field(..., min_items=1, max_items=4)


class PredictionResponse(BaseModel):
    organic_matter: str
    process: Optional[dict] = None


class PredictionResponseKerogen(BaseModel):
    organic_matter: str


# модели классификации типа ов выдают результат в виде чисел от 0 до 2
# словарь для перевода в текстовые классы
organic_matter_classes = {0: 'морское',
                          1: 'смешанное',
                          2: 'терригенное'}


@app.post('/app/predict_kerogen', response_model=PredictionResponseKerogen, summary='предсказания для керогена')
async def predict(req: PredictionRequest):
    X = np.array(req.measurements).reshape(1, -1)
    organic_matter = organic_matter_model_kerogen.predict(X).item()

    return PredictionResponseKerogen(
        organic_matter=organic_matter_classes[organic_matter]
    )


@app.post("/api/predict", response_model=PredictionResponse, summary='предсказания для нефти и битумоида')
async def predict(req: PredictionRequest):
    X = np.array(req.measurements).reshape(1, -1)

    organic_matter = None
    bio = None
    oxid = None
    therm = None

    # определение процесса
    organic_matter = organic_matter_model_oil_bitumoid.predict(
        X).item()

    # применение моделей для предсказания процесса
    # биодеградация присуща только для нефтей, но изменения по фракциям такие же, как в термическом воздействии для битумоидов
    # так как не было особо образцов с нефтями, использую модель для термического преобразования
    if req.sample_type.lower() == 'нефть':
        bio = thermal_alteration_model.predict(X).item()
    else:
        bio = 0

    # окисление
    oxid = oxidation_model.predict(X).item()

    # термическое воздействие - проверить нефть/не нефть
    therm = thermal_alteration_model.predict(X).item()

    return PredictionResponse(
        organic_matter=organic_matter_classes[organic_matter],
        process={
            "biodegradation": bio,
            "oxidation": oxid,
            "thermal": therm
        },

    )


# раздача фронтенда
FRONTEND_DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="frontend"
    )

    @app.get("/")
    async def root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

# запуск API и фронтенда
# cd backend
# uvicorn api:app --host 0.0.0.0 --port 8000
