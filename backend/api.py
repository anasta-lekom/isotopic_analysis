from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple
import numpy as np
from catboost import CatBoostClassifier
import os
import pandas as pd
from io import StringIO
from sklearn.linear_model import LinearRegression

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
organic_matter_model_express = CatBoostClassifier()
organic_matter_model_oil_bitumoid = CatBoostClassifier()
thermal_alteration_model = CatBoostClassifier()
oxidation_model = CatBoostClassifier()
migration_model = CatBoostClassifier()


organic_matter_model_express.load_model(
    os.path.join(BASE_DIR, "catboost_multiclass_organic_matter_express.cbm")
)
organic_matter_model_oil_bitumoid.load_model(
    os.path.join(BASE_DIR, "catboost_multiclass_organic_matter_oil_bitumoid.cbm")
)
thermal_alteration_model.load_model(
    os.path.join(BASE_DIR, "catboost_thermal_alteration_knn_imputer.cbm")
)
oxidation_model.load_model(
    os.path.join(BASE_DIR, "catboost_oxidation_iterative_imputer.cbm")
)
migration_model_path = os.path.join(BASE_DIR, "catboost_migration.cbm")
if os.path.exists(migration_model_path):
    migration_model.load_model(migration_model_path)




# модели для запросов
class PredictionRequest(BaseModel):
    sample_type: str = Field(
        ..., description="Введите тип образца: 'нефть' или 'битумоид' или 'кероген")
    measurements: List[float] = Field(..., min_items=1, max_items=4)


class OilSourceCorrelationRequest(BaseModel):
    oil_measurements: Tuple[float, float, float, float] = Field(..., description="Изотопные измерения")
    kerogen_measurements: float = Field(...)


class Sample(BaseModel):
    sat: float
    aro: float
    res: float
    asph: float




# модели для ответов
class PredictionResponse(BaseModel):
    organic_matter: str
    process: Optional[dict] = None


class PredictionResponseExpress(BaseModel):
    organic_matter: str


class OilSourceCorrelationResponse(BaseModel):
    correlation: Optional[dict]




# модели классификации типа ов выдают результат в виде чисел от 0 до 2
# словарь для перевода в текстовые классы
organic_matter_classes = {0: 'морское',
                          1: 'смешанное',
                          2: 'терригенное'}


@app.post('/app/predict_express', response_model=PredictionResponseExpress, summary='экспресс-оценка типа ОВ для Total oil/Total Bitumoid')
async def predict_express(req: PredictionRequest):
    X = np.array(req.measurements).reshape(1, -1)
    organic_matter = organic_matter_model_express.predict(X).item()  

    return PredictionResponseExpress(
        organic_matter=organic_matter_classes[organic_matter]
    )



@app.post("/api/predict", response_model=PredictionResponse, summary='предсказания для нефти и битумоида')
async def predict_main(req: PredictionRequest):
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


@app.post('/api/oil-source-correlation', summary='корреляция нефти и керогена')
async def oil_source_correlation(req: OilSourceCorrelationRequest):
    mean_oil = np.mean(req.oil_measurements)
    kerogen_value = req.kerogen_measurements
    correlation = bool(abs(mean_oil - kerogen_value) <= 2)
    return OilSourceCorrelationResponse(
        correlation={'есть ли связь между керогеном и нефтью': correlation})




def detect_outliers(df: pd.DataFrame, threshold_corr=0.7, residual_std_factor=2):

    corr = df["asph"].corr(df["res"])
    df = df.copy()

    # создаём колонки заранее
    df["oxidation"] = None
    df["thermal_alteration"] = None
    df["OM_model"] = None
    df["OM_Sofer"] = None
    df["migration"] = None


    # Определяем выбросы на основе корреляции между asph и res
    if corr > threshold_corr:

        X_reg = df[["asph"]].values
        y = df["res"].values

        model = LinearRegression()
        model.fit(X_reg, y)

        y_pred = model.predict(X_reg)
        residuals = y - y_pred
        std_res = np.std(residuals)

        df["is_outlier"] = np.abs(residuals) > residual_std_factor * std_res

    else:
        df["is_outlier"] = True

    # ---------------------------------------
    # 2. Маски
    # ---------------------------------------

    non_outliers_mask = ~df["is_outlier"]
    outliers_mask = df["is_outlier"]

    features_cols = ["sat", "aro", "res", "asph"]

    # ---------------------------------------
    # 3. НЕ выбросы
    # ---------------------------------------

    if non_outliers_mask.any():

        df.loc[non_outliers_mask, "oxidation"] = 0
        df.loc[non_outliers_mask, "thermal_alteration"] = 0

        # OM_model для невыбросов
        df.loc[non_outliers_mask, "OM_model"] = \
            organic_matter_model_oil_bitumoid.predict(
                df.loc[non_outliers_mask, features_cols].values
            )



        # Sofer классификация
        aro_terrestial = 1.12 * df["sat"] + 5.45
        aro_marine = 1.1 * df["sat"] + 3.75

        df.loc[non_outliers_mask, "OM_Sofer"] = np.where(
            df.loc[non_outliers_mask, "aro"] > aro_terrestial[non_outliers_mask],
            "терригенное",
            np.where(
                df.loc[non_outliers_mask, "aro"] < aro_marine[non_outliers_mask],
                "морское",
                "смешанное"
            )
        )

        df.loc[non_outliers_mask, "migration"] = \
            abs(df.loc[non_outliers_mask, "sat"] -
                df.loc[non_outliers_mask, "aro"]) > 1

    # ---------------------------------------
    # 4. Выбросы
    # ---------------------------------------

    if outliers_mask.any():

        df.loc[outliers_mask, "oxidation"] = \
            oxidation_model.predict(
                df.loc[outliers_mask, features_cols].values
            )

        df.loc[outliers_mask, "thermal_alteration"] = \
            thermal_alteration_model.predict(
                df.loc[outliers_mask, features_cols].values
            )

        df.loc[outliers_mask, "OM_model"] = \
            organic_matter_model_oil_bitumoid.predict(
                df.loc[outliers_mask, features_cols].values
            )

        df.loc[outliers_mask, "OM_Sofer"] = None

        df.loc[outliers_mask, "migration"] = \
            abs(df.loc[outliers_mask, "sat"] -
                df.loc[outliers_mask, "aro"]) > 1
        
    # Переводим числовые классы в текст
    df["OM_model"] = df["OM_model"].astype(int)
    df["OM_model"] = df["OM_model"].map(organic_matter_classes)

    return corr, df







@app.post('/api/many_samples', summary='предсказание для нескольких образцов')
async def predict_many_samples(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="файл не в формате CSV")

    contents = await file.read()

    df = None
    for enc in ("utf-8", "utf-8-sig", "cp1251", "windows-1251"):
        try:
            decoded = contents.decode(enc)
    
            df = pd.read_csv(StringIO(decoded), sep=';')
            break
        except Exception:
            continue

    if df is None:
        raise HTTPException(
            status_code=400,
            detail="данные не удалось прочитать. Убедитесь, что файл в формате CSV и попробуйте другой кодировкой (utf-8, utf-8-sig, cp1251, windows-1251)"
        )

    # проверяем наличие необходимых колонок
    required_columns = ["№", "sat", "aro", "res", "asph"]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"отсутствуют необходимые колонки: {missing_columns}. Доступные колонки: {list(df.columns)}"
        )

    df[required_columns] = (df[required_columns].replace(",", ".", regex=True).astype(float))
    corr, result_df = detect_outliers(df)

    return {
        "corr": corr,
        "result_df": result_df.to_dict(orient="records")
    }





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
