import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

// Категории
const categories = ["Насыщенная фракция", "Ароматическая фракция", "Смолистая фракция", "Асфальтены"];

// Начальные точки
const initialPoints = [
  { x: "", y: "Насыщенная фракция" },
  { x: "", y: "Ароматическая фракция" },
  { x: "", y: "Смолистая фракция" },
  { x: "", y: "Асфальтены" }
];

// Генерация осевых меток
const generateXTicks = (min, max, maxTicks = 10) => {
  const range = max - min;
  if (range <= maxTicks) {
    const ticks = [];
    for (let i = Math.floor(min); i <= Math.ceil(max); i++) ticks.push(i);
    return ticks;
  } else {
    const step = Math.ceil(range / maxTicks);
    const ticks = [];
    let start = Math.floor(min / step) * step;
    for (let i = start; i <= max; i += step) ticks.push(i);
    return ticks;
  }
};

// Функция для отправки запроса на бэкенд
const analyzeData = async (sampleType, measurements) => {
  try {
    // Определяем эндпоинт в зависимости от типа образца
    const endpoint = sampleType === "кероген"
      ? '/app/predict_kerogen'
      : '/api/predict';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sample_type: sampleType,
        measurements: measurements
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error analyzing data:', error);
    throw error;
  }
};

// Блок с графиком и полями
const ChartBlock = ({ mode, points, kerogenValue, onModeChange, onPointChange, onKerogenChange, onAnalyze, analysisResult, onClearResult }) => {
  const parsedData = points.map((p) => ({
    x: parseFloat(p.x) || 0,
    y: categories.indexOf(p.y)
  }));

  const xValues = parsedData.map(d => d.x);
  const rawMin = Math.min(...xValues);
  const rawMax = Math.max(...xValues);
  const xMin = Math.floor(rawMin - 1);
  const xMax = Math.ceil(rawMax + 1);
  const xTicks = generateXTicks(xMin, xMax, 10);

  const fontFamily = "'Roboto', sans-serif"; // единый шрифт для всего блока

  // Подготовка данных для отправки на бэкенд
  const prepareMeasurements = () => {
    if (mode === "kerogen") {
      // Для керогена - одно значение
      const value = parseFloat(kerogenValue);
      if (isNaN(value)) {
        throw new Error("Введите корректное значение керогена");
      }
      if (value < -50 || value > 0) {
        throw new Error("Значение керогена должно быть в диапазоне от -50 до 0");
      }
      return [value];
    } else {
      // Для нефти/битумоида - 4 значения в определенном порядке
      const measurements = [
        parseFloat(points[0].x), // Насыщенная фракция
        parseFloat(points[1].x), // Ароматическая фракция
        parseFloat(points[2].x), // Смолистая фракция
        parseFloat(points[3].x)  // Асфальтены
      ];

      // Валидация
      if (measurements.some(isNaN)) {
        throw new Error("Заполните все поля значениями");
      }

      if (measurements.some(val => val < -50 || val > 0)) {
        throw new Error("Все значения должны быть в диапазоне от -50 до 0");
      }

      return measurements;
    }
  };

  // Получение названия типа образца для бэкенда
  const getSampleType = () => {
    if (mode === "oil") return "нефть";
    if (mode === "bitumoid") return "битумоид";
    if (mode === "kerogen") return "кероген";
    return "нефть";
  };

  // Форматирование результата для отображения
  const formatResult = (result) => {
    if (!result) return null;

    if (result.loading) {
      return (
        <div style={{ color: "#2196f3", fontWeight: "bold" }}>
          <div>Анализ выполняется...</div>
          <div style={{ fontSize: 14, marginTop: 5 }}>Пожалуйста, подождите</div>
        </div>
      );
    }

    if (result.error) {
      return (
        <div style={{ color: "#f44336", fontWeight: "bold" }}>
          <div>Ошибка анализа:</div>
          <div style={{ fontSize: 14, marginTop: 5 }}>{result.error}</div>
        </div>
      );
    }

    // Успешный результат
    return (
      <div>
        <div style={{ marginBottom: 15 }}>
          <strong>Тип органического вещества:</strong>
          <div style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#4caf50",
            marginTop: 5,
            padding: 10,
            backgroundColor: "#e8f5e9",
            borderRadius: 5
          }}>
            {result.organic_matter}
          </div>
        </div>

        {result.process && (
          <div>
            <strong>Процессы преобразования:</strong>
            <div style={{ marginTop: 10, paddingLeft: 15 }}>
              <div>
                <span style={{ fontWeight: "bold" }}>Биодеградация:</span> {result.process.biodegradation}
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>Окисление:</span> {result.process.oxidation}
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>Термическое воздействие:</span> {result.process.thermal}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        backgroundColor: "white",
        borderRadius: 15,
        padding: 40,
        maxWidth: 1300,
        margin: "20px auto",
        gap: 15,
        fontFamily // применяем шрифт ко всему блоку
      }}
    >
      {/* Левая часть */}
      <div
        style={{
          minWidth: 350,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          marginTop: 50,
          marginLeft: 50
        }}
      >
        {/* Верхние кнопки */}
        <div style={{ marginBottom: 25 }}>
          {["oil", "bitumoid", "kerogen"].map((m) => (
            <button
              key={m}
              onClick={() => {
                onModeChange(m);
                onClearResult(); // Очистка результата при смене режима
              }}
              style={{
                padding: "14px 28px",
                marginRight: m !== "kerogen" ? 14 : 0,
                fontSize: 16,
                backgroundColor: mode === m ? "#4caf50" : "#e0e0e0",
                color: mode === m ? "white" : "black",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: "bold",
                transition: "all 0.3s",
                fontFamily
              }}
              onMouseOver={(e) => { e.target.style.backgroundColor = mode === m ? "#45a049" : "#d5d5d5"; }}
              onMouseOut={(e) => { e.target.style.backgroundColor = mode === m ? "#4caf50" : "#e0e0e0"; }}
            >
              {m === "oil" ? "Нефть" : m === "bitumoid" ? "Битумоид" : "Кероген"}
            </button>
          ))}
        </div>

        {/* Поля ввода */}
        {(mode === "oil" || mode === "bitumoid") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {["Асфальтены", "Смолистая фракция", "Ароматическая фракция", "Насыщенная фракция"].map((label) => {
              const index = categories.indexOf(label);
              return (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 180, textAlign: "right", fontSize: 18, fontWeight: 500 }}>{label}</div>
                  <input
                    type="number"
                    step="0.01"
                    min="-50"
                    max="0"
                    value={points[index].x}
                    onChange={(e) => onPointChange(index, e.target.value)}
                    style={{
                      flexGrow: 1,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      fontSize: 16,
                      fontFamily
                    }}
                    placeholder="от -50 до 0"
                  />
                </div>
              );
            })}
            <div style={{ fontSize: 14, color: "#666", fontStyle: "italic", marginTop: 5 }}>
              Введите значения δ13C (в ‰, от -50 до 0)
            </div>
          </div>
        )}

        {mode === "kerogen" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 180, textAlign: "right", fontSize: 18, fontWeight: 500 }}>Кероген</div>
              <input
                type="number"
                step="0.01"
                min="-50"
                max="0"
                value={kerogenValue}
                onChange={(e) => onKerogenChange(e.target.value)}
                style={{
                  flexGrow: 1,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  fontSize: 16,
                  fontFamily
                }}
                placeholder="от -50 до 0"
              />
            </div>
            <div style={{ fontSize: 14, color: "#666", fontStyle: "italic", marginTop: 5 }}>
              Введите значение δ13C керогена (в ‰, от -50 до 0)
            </div>
          </div>
        )}

        {/* Кнопка "Проанализировать" */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => {
              try {
                const measurements = prepareMeasurements();
                const sampleType = getSampleType();
                onAnalyze(sampleType, measurements);
              } catch (error) {
                alert(error.message);
              }
            }}
            style={{
              padding: "14px 28px",
              fontSize: 18,
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: "bold",
              transition: "all 0.3s",
              fontFamily,
              width: "100%"
            }}
            onMouseOver={(e) => { e.target.style.backgroundColor = "#1976d2"; }}
            onMouseOut={(e) => { e.target.style.backgroundColor = "#2196f3"; }}
          >
            Проанализировать
          </button>
        </div>

        {/* Отображение результата анализа */}
        {analysisResult && (
          <div style={{
            marginTop: 20,
            padding: 20,
            backgroundColor: analysisResult.error ? "#ffebee" : "#e8f5e9",
            borderRadius: 10,
            border: analysisResult.error ? "2px solid #f44336" : "2px solid #4caf50"
          }}>
            {formatResult(analysisResult)}

            {!analysisResult.loading && (
              <button
                onClick={onClearResult}
                style={{
                  marginTop: 15,
                  padding: "10px 20px",
                  fontSize: 14,
                  backgroundColor: "#ff5722",
                  color: "white",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily,
                  width: "100%"
                }}
              >
                Очистить результат
              </button>
            )}
          </div>
        )}
      </div>

      {/* Правая часть: график */}
      {mode !== "kerogen" && (
        <LineChart
          width={780}
          height={480}
          data={parsedData}
          margin={{ top: 50, right: 50, bottom: 50, left: 140 }}
          style={{ backgroundColor: "white", borderRadius: 15 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[xMin, xMax]}
            ticks={xTicks}
            tick={{ fontFamily, fontSize: 16 }}
            label={{ value: "δ13C (‰)", position: "insideBottom", offset: -5, fontSize: 14 }}
          />
          <YAxis
            type="number"
            domain={[-0.5, categories.length - 0.5]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(value) => categories[value]}
            width={160}
            tick={{ fontFamily, fontSize: 16 }}
          />
          <Tooltip
            contentStyle={{ fontFamily, fontSize: 16 }}
            formatter={(value, name) => [`${value} ‰`, name]}
            labelFormatter={(label) => `δ13C: ${label} ‰`}
          />
          <Line
            type="linear"
            dataKey="y"
            stroke="#82ca9d"
            dot={{ r: 6, fill: "#4caf50" }}
            activeDot={{ r: 8 }}
            isAnimationActive
          />
        </LineChart>
      )}
    </div>
  );
};

// Основной компонент
const DynamicCategoryChart = () => {
  const [blocks, setBlocks] = useState([
    {
      mode: "oil",
      points: initialPoints,
      kerogenValue: "",
      analysisResult: null
    }
  ]);



  // Функция для анализа данных
  const handleAnalyze = async (blockIndex, sampleType, measurements) => {
    try {
      // Показываем индикатор загрузки
      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], analysisResult: { loading: true } };
        return nextBlocks;
      });

      // Отправляем запрос на бэкенд
      const result = await analyzeData(sampleType, measurements);

      // Обновляем результат
      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], analysisResult: result };
        return nextBlocks;
      });


    } catch (error) {
      console.error('Analysis error:', error);
      // Показываем ошибку
      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = {
          ...nextBlocks[blockIndex],
          analysisResult: { error: error.message || '???????????? ?????? ?????????????? ????????????' }
        };
        return nextBlocks;
      });
    }
  };

  // Функция для очистки результата
  const handleClearResult = (blockIndex) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], analysisResult: null };
    setBlocks(newBlocks);
  };

  return (
    <div style={{ fontFamily: "'Roboto', sans-serif", padding: 40, backgroundColor: "#f0f2f5", minHeight: "100vh" }}>

      {/*ЗАГОЛОВОК */}
      <h1 style={{
        textAlign: "center",
        maxWidth: 1100,
        margin: "0 auto 50px",
        fontSize: 28,
        lineHeight: 1.4
      }}>
        Определение типа органического вещества и вторичных процессов
        по соотношениям стабильных изотопов углерода
      </h1>


      {blocks.map((block, index) => (
        <ChartBlock
          key={index}
          mode={block.mode}
          points={block.points}
          kerogenValue={block.kerogenValue}
          analysisResult={block.analysisResult}
          onModeChange={(newMode) => {
            const newBlocks = [...blocks];
            newBlocks[index].mode = newMode;
            if (newMode === "kerogen") {
              newBlocks[index].kerogenValue = "";
              newBlocks[index].points = initialPoints.map(p => ({ ...p, x: "" }));
            } else {
              newBlocks[index].points = initialPoints.map(p => ({ ...p, x: "" }));
              newBlocks[index].kerogenValue = "";
            }
            newBlocks[index].analysisResult = null; // Очистка результата при смене режима
            setBlocks(newBlocks);
          }}
          onPointChange={(i, value) => {
            const newBlocks = [...blocks];
            newBlocks[index].points[i].x = value;
            setBlocks(newBlocks);
          }}
          onKerogenChange={(value) => {
            const newBlocks = [...blocks];
            newBlocks[index].kerogenValue = value;
            setBlocks(newBlocks);
          }}
          onAnalyze={(sampleType, measurements) => handleAnalyze(index, sampleType, measurements)}
          onClearResult={() => handleClearResult(index)}
        />
      ))}
    </div>
  );
};

export default DynamicCategoryChart;