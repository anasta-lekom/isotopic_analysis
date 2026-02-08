
# Oil Isotope ML Web Application

Веб-приложение для определения типа органического вещества и вторичных геохимических процессов
на основе изотопных данных с использованием машинного обучения.

Проект состоит из:

* Backend: FastAPI (Python)
* Frontend: React + Vite
* ML модели: CatBoost
* Контейнеризация: Docker + Docker Compose

---

## Возможности

* Анализ изотопных данных и отрисовка графиков по ним
* Определение типа органического вещества
* Определение вторичных процессов (термическое воздействие, окисление, биодеградация)


---

## Структура проекта

project/
├── backend/
│   ├── api.py
│   ├── catboost_multiclass_organic_matter_kerogen.cbm
│   ├── catboost_multiclass_organic_matter_oil_bitumoid.cbm
│   ├── catboost_thermal_alteration_knn_imputer.cbm
│   ├── catboost_oxidation_no_imputer.cbm
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   └── public/
├── docker-compose.yml
├── .gitignore
└── README.md

---

## Запуск проекта через Docker

### Клонирование репозитория

git clone [<URL_РЕПОЗИТОРИЯ>](https://github.com/anasta-lekom/diplom.git)
cd project

### Сборка и запуск контейнеров

docker-compose up --build

### Открыть приложение

[http://localhost:8000](http://localhost:8000)

---

## API эндпоинты

* GET / — фронтенд приложения
* POST /api/predict — предсказания для нефти и битумоида
* POST /app/predict_kerogen — предсказание для керогена

Описание входных и выходных параметров см. в файле backend/api.py.

---

## Требования

Для запуска через Docker:

* Docker
* Docker Compose

