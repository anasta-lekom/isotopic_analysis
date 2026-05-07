import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

const categories = [
  "Насыщенная фракция",
  "Ароматическая фракция",
  "Смолистая фракция",
  "Асфальтены"
];

const initialPoints = [
  { x: "", y: "Насыщенная фракция" },
  { x: "", y: "Ароматическая фракция" },
  { x: "", y: "Смолистая фракция" },
  { x: "", y: "Асфальтены" }
];

const generateXTicks = (min, max, maxTicks = 10) => {
  const range = max - min;
  if (range <= maxTicks) {
    const ticks = [];
    for (let i = Math.floor(min); i <= Math.ceil(max); i += 1) ticks.push(i);
    return ticks;
  }

  const step = Math.ceil(range / maxTicks);
  const ticks = [];
  const start = Math.floor(min / step) * step;
  for (let i = start; i <= max; i += step) ticks.push(i);
  return ticks;
};

const analyzeData = async (sampleType, measurements, kerogenMeasurement = null) => {
  const endpoint = sampleType === "correlation"
    ? "/api/oil-source-correlation"
    : sampleType === "кероген"
      ? "/app/predict_express"
      : "/api/predict";

  const payload = sampleType === "correlation"
    ? {
      oil_measurements: measurements,
      kerogen_measurements: kerogenMeasurement
    }
    : {
      sample_type: sampleType,
      measurements
    };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

const ChartBlock = ({
  mode,
  points,
  kerogenValue,
  analysisResult,
  onModeChange,
  onPointChange,
  onKerogenChange,
  onAnalyze,
  onClearResult,
  manySamplesFile,
  manySamplesLoading,
  manySamplesError,
  manySamplesResult,
  manySamplesCorr,
  onManySamplesFileChange,
  onManySamplesAnalyze,
  manySamplesChartData,
  manySamplesInliers,
  manySamplesOutliers,
  manySamplesRegressionLine
}) => {
  const parsedData = points.map((p) => ({
    x: parseFloat(p.x) || 0,
    y: categories.indexOf(p.y)
  }));

  const xValues = parsedData.map((d) => d.x);
  const rawMin = Math.min(...xValues);
  const rawMax = Math.max(...xValues);
  const xMin = Math.floor(rawMin - 1);
  const xMax = Math.ceil(rawMax + 1);
  const xTicks = generateXTicks(xMin, xMax, 10);

  const fontFamily = "'Roboto', sans-serif";

  const prepareMeasurements = () => {
    if (mode === "correlation") {
      const measurements = [
        parseFloat(points[0].x),
        parseFloat(points[1].x),
        parseFloat(points[2].x),
        parseFloat(points[3].x)
      ];
      const value = parseFloat(kerogenValue);

      if (measurements.some(Number.isNaN) || Number.isNaN(value)) {
        throw new Error("Заполните все поля значениями");
      }
      if (measurements.some((val) => val < -50 || val > 0) || value < -50 || value > 0) {
        throw new Error("Все значения должны быть в диапазоне от -50 до 0");
      }

      return { measurements, kerogenMeasurement: value };
    }

    if (mode === "kerogen") {
      const value = parseFloat(kerogenValue);
      if (Number.isNaN(value)) throw new Error("Введите корректное значение");
      if (value < -50 || value > 0) throw new Error("Значение должно быть в диапазоне от -50 до 0");
      return { measurements: [value], kerogenMeasurement: null };
    }

    const measurements = [
      parseFloat(points[0].x),
      parseFloat(points[1].x),
      parseFloat(points[2].x),
      parseFloat(points[3].x)
    ];

    if (measurements.some(Number.isNaN)) throw new Error("Заполните все поля значениями");
    if (measurements.some((val) => val < -50 || val > 0)) {
      throw new Error("Все значения должны быть в диапазоне от -50 до 0");
    }

    return { measurements, kerogenMeasurement: null };
  };

  const getSampleType = () => {
    if (mode === "oil") return "нефть";
    if (mode === "bitumoid") return "битумоид";
    if (mode === "kerogen") return "кероген";
    if (mode === "correlation") return "correlation";
    return "нефть";
  };

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

    if (mode === "correlation" && result.correlation) {
      const firstKey = Object.keys(result.correlation)[0];
      const isLinked = firstKey ? Boolean(result.correlation[firstKey]) : false;
      return (
        <div>
          <strong>Оценка связи керогена и нефти:</strong>
          <div
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: isLinked ? "#4caf50" : "#f44336",
              marginTop: 8,
              padding: 10,
              backgroundColor: isLinked ? "#e8f5e9" : "#ffebee",
              borderRadius: 5
            }}
          >
            {isLinked ? "Связь подтверждена" : "Связь не подтверждена"}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 15 }}>
          <strong>Тип органического вещества:</strong>
          <div
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#4caf50",
              marginTop: 5,
              padding: 10,
              backgroundColor: "#e8f5e9",
              borderRadius: 5
            }}
          >
            {result.organic_matter}
          </div>
        </div>

        {result.process && (
          <div>
            <strong>Процессы преобразования:</strong>
            <div style={{ marginTop: 10, paddingLeft: 15 }}>
              {(mode === "oil" && result.process.thermal === 1) && (
                <div>
                  <span style={{ fontWeight: "bold" }}>Биодеградация:</span> {result.process.biodegradation} <span style={{ color: "red", fontWeight: "bold" }}>*</span>
                </div>
              )}
              {!(mode === "oil" && result.process.thermal === 1) && (
                <div>
                  <span style={{ fontWeight: "bold" }}>Биодеградация:</span> {result.process.biodegradation}
                </div>
              )}
              <div>
                <span style={{ fontWeight: "bold" }}>Окисление:</span> {result.process.oxidation}
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>Термическое воздействие:</span> {result.process.thermal} {(mode === "bitumoid" || mode === "oil") && result.process.thermal === 1 && <span style={{ color: "red", fontWeight: "bold" }}>*</span>}
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>Миграция (приход флюида):</span> {result.process.migration_in}
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>Миграция (уход флюида):</span> {result.process.migration_out} {(mode === "bitumoid" || mode === "oil") && result.process.thermal === 1 && <span style={{ color: "red", fontWeight: "bold" }}>*</span>}
              </div>
            </div>
            {((mode === "bitumoid" || mode === "oil") && result.process.thermal === 1) && (
              <div style={{ marginTop: 15, color: "red", fontWeight: "bold", fontSize: 14 }}>
                * для уточнения процесса необходимо привлечение дополнительной геологической информации
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        borderRadius: 15,
        padding: 40,
        maxWidth: 1300,
        margin: "20px auto",
        gap: 15,
        fontFamily
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          overflowX: "auto",
          gap: 10,
          marginBottom: 20
        }}
      >
        {["oil", "bitumoid", "kerogen", "correlation", "many_samples"].map((m) => (
          <button
            key={m}
            onClick={() => {
              onModeChange(m);
              onClearResult();
            }}
            style={{
              padding: "14px 22px",
              fontSize: 16,
              backgroundColor: mode === m ? "#4caf50" : "#e0e0e0",
              color: mode === m ? "white" : "black",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: "bold",
              transition: "all 0.3s",
              fontFamily,
              whiteSpace: "nowrap",
              flex: "0 0 auto"
            }}
          >
            {m === "oil"
              ? "Нефть"
              : m === "bitumoid"
                ? "Битумоид"
                : m === "kerogen"
                  ? "Экспресс-тест типа ОВ"
                  : m === "correlation"
                    ? "Связь кероген-нефть"
                    : "Анализ нескольких образцов (CSV)"}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 15
        }}
      >
        <div
          style={{
            minWidth: 350,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginTop: 50,
            marginLeft: 50,
            flex: 1
          }}
        >
          {(mode === "oil" || mode === "bitumoid" || mode === "correlation") && (
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

          {(mode === "kerogen" || mode === "correlation") && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {mode === "correlation" && (
                  <div style={{ width: 180, textAlign: "right", fontSize: 18, fontWeight: 500 }}>Кероген</div>
                )}
                <input
                  type="number"
                  step="0.01"
                  min="-50"
                  max="0"
                  value={kerogenValue}
                  onChange={(e) => onKerogenChange(e.target.value)}
                  style={{
                    flexGrow: mode === "correlation" ? 1 : 0,
                    width: mode === "kerogen" ? "100%" : undefined,
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
                Введите значение δ13C образца (в ‰, от -50 до 0)
              </div>
            </div>
          )}

          {mode === "many_samples" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                id="csv-upload-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onManySamplesFileChange(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <label
                htmlFor="csv-upload-input"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "fit-content",
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #90caf9",
                  background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                  color: "#0d47a1",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Выбрать CSV-файл
              </label>

              <div
                style={{
                  border: "1px dashed #cfd8dc",
                  borderRadius: 10,
                  padding: "10px 12px",
                  backgroundColor: "#fafcfe",
                  fontSize: 14,
                  color: manySamplesFile ? "#1b5e20" : "#607d8b"
                }}
              >
                {manySamplesFile ? `Выбран файл: ${manySamplesFile.name}` : "Файл не выбран"}
              </div>

              <div style={{ fontSize: 13, color: "#607d8b" }}>
                Поддерживается только формат `.csv` с колонками `sat`, `aro`, `res`, `asph`.
              </div>
              {manySamplesCorr !== null && (
                <div style={{ color: "#424242" }}>
                  Коэффициент корреляции asph-res: <strong>{Number(manySamplesCorr).toFixed(3)}</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            {mode !== "many_samples" ? (
              <button
                onClick={() => {
                  try {
                    const { measurements, kerogenMeasurement } = prepareMeasurements();
                    const sampleType = getSampleType();
                    onAnalyze(sampleType, measurements, kerogenMeasurement);
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
              >
                Проанализировать
              </button>
            ) : (
              <button
                onClick={onManySamplesAnalyze}
                disabled={manySamplesLoading}
                style={{
                  padding: "14px 28px",
                  fontSize: 18,
                  backgroundColor: manySamplesLoading ? "#90caf9" : "#2196f3",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  cursor: manySamplesLoading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  transition: "all 0.3s",
                  fontFamily,
                  width: "100%"
                }}
              >
                {manySamplesLoading ? "Обработка..." : "Загрузить и проанализировать"}
              </button>
            )}
          </div>

          {mode !== "many_samples" && analysisResult && (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                backgroundColor: analysisResult.error ? "#ffebee" : "#e8f5e9",
                borderRadius: 10,
                border: analysisResult.error ? "2px solid #f44336" : "2px solid #4caf50"
              }}
            >
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

          {mode === "many_samples" && manySamplesError && (
            <div
              style={{
                marginTop: 20,
                padding: 20,
                backgroundColor: "#ffebee",
                borderRadius: 10,
                border: "2px solid #f44336"
              }}
            >
              {manySamplesError && <div style={{ color: "#f44336", fontWeight: "bold" }}>{manySamplesError}</div>}
            </div>
          )}
        </div>

        {(mode === "oil" || mode === "bitumoid") && (
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

        {mode === "many_samples" && (
          <ComposedChart width={780} height={480} data={manySamplesChartData} margin={{ top: 30, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="asph" name="asph" label={{ value: "asph", position: "insideBottom", offset: -5 }} />
            <YAxis type="number" dataKey="res" name="res" label={{ value: "res", angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(value, name) => [value, name]} />
            <Scatter name="Нормальные точки" data={manySamplesInliers} fill="#1e88e5" />
            <Scatter name="Выбросы" data={manySamplesOutliers} fill="#f44336" />
            {manySamplesRegressionLine.length === 2 && (
              <Line
                type="linear"
                data={manySamplesRegressionLine}
                dataKey="res"
                stroke="#2e7d32"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        )}
      </div>
    </div>
  );
};

const DynamicCategoryChart = () => {
  const [blocks, setBlocks] = useState([
    {
      mode: "oil",
      points: initialPoints,
      kerogenValue: "",
      analysisResult: null
    }
  ]);

  const [manySamplesFile, setManySamplesFile] = useState(null);
  const [manySamplesLoading, setManySamplesLoading] = useState(false);
  const [manySamplesError, setManySamplesError] = useState(null);
  const [manySamplesResult, setManySamplesResult] = useState([]);
  const [manySamplesCorr, setManySamplesCorr] = useState(null);

  const handleAnalyze = async (blockIndex, sampleType, measurements, kerogenMeasurement = null) => {
    try {
      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], analysisResult: { loading: true } };
        return nextBlocks;
      });

      const result = await analyzeData(sampleType, measurements, kerogenMeasurement);

      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], analysisResult: result };
        return nextBlocks;
      });
    } catch (error) {
      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];
        nextBlocks[blockIndex] = {
          ...nextBlocks[blockIndex],
          analysisResult: { error: error.message || "Ошибка при выполнении анализа" }
        };
        return nextBlocks;
      });
    }
  };

  const handleClearResult = (blockIndex) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], analysisResult: null };
    setBlocks(newBlocks);
  };

  const handleManySamplesAnalyze = async () => {
    if (!manySamplesFile) {
      setManySamplesError("Выберите CSV-файл для анализа");
      return;
    }

    if (!manySamplesFile.name.toLowerCase().endsWith(".csv")) {
      setManySamplesError("Файл должен быть в формате .csv");
      return;
    }

    try {
      setManySamplesLoading(true);
      setManySamplesError(null);

      const formData = new FormData();
      formData.append("file", manySamplesFile);

      const response = await fetch("/api/many_samples", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setManySamplesResult(Array.isArray(result.result_df) ? result.result_df : []);
      setManySamplesCorr(result.corr ?? null);
    } catch (error) {
      setManySamplesError(error.message || "Ошибка при анализе CSV");
    } finally {
      setManySamplesLoading(false);
    }
  };

  const manySamplesChartData = useMemo(
    () => manySamplesResult
      .map((row, idx) => ({
        id: idx,
        asph: Number(row.asph),
        res: Number(row.res),
        is_outlier: row.is_outlier === true || row.is_outlier === "True" || row.is_outlier === 1
      }))
      .filter((row) => Number.isFinite(row.asph) && Number.isFinite(row.res)),
    [manySamplesResult]
  );

  const manySamplesInliers = useMemo(
    () => manySamplesChartData.filter((row) => !row.is_outlier),
    [manySamplesChartData]
  );

  const manySamplesOutliers = useMemo(
    () => manySamplesChartData.filter((row) => row.is_outlier),
    [manySamplesChartData]
  );

  const manySamplesRegressionLine = useMemo(() => {
    if (manySamplesChartData.length < 2) return [];

    const n = manySamplesChartData.length;
    const sumX = manySamplesChartData.reduce((acc, p) => acc + p.asph, 0);
    const sumY = manySamplesChartData.reduce((acc, p) => acc + p.res, 0);
    const sumXX = manySamplesChartData.reduce((acc, p) => acc + p.asph * p.asph, 0);
    const sumXY = manySamplesChartData.reduce((acc, p) => acc + p.asph * p.res, 0);

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const xMin = Math.min(...manySamplesChartData.map((p) => p.asph));
    const xMax = Math.max(...manySamplesChartData.map((p) => p.asph));

    return [
      { asph: xMin, res: slope * xMin + intercept },
      { asph: xMax, res: slope * xMax + intercept }
    ];
  }, [manySamplesChartData]);

  const isManySamplesMode = blocks.some((block) => block.mode === "many_samples");

  return (
    <div style={{ fontFamily: "'Roboto', sans-serif", padding: 40, backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
      <h1
        style={{
          textAlign: "center",
          maxWidth: 1100,
          margin: "0 auto 50px",
          fontSize: 28,
          lineHeight: 1.4
        }}
      >
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
          manySamplesFile={manySamplesFile}
          manySamplesLoading={manySamplesLoading}
          manySamplesError={manySamplesError}
          manySamplesResult={manySamplesResult}
          manySamplesCorr={manySamplesCorr}
          manySamplesChartData={manySamplesChartData}
          manySamplesInliers={manySamplesInliers}
          manySamplesOutliers={manySamplesOutliers}
          manySamplesRegressionLine={manySamplesRegressionLine}
          onManySamplesFileChange={setManySamplesFile}
          onManySamplesAnalyze={handleManySamplesAnalyze}
          onModeChange={(newMode) => {
            const newBlocks = [...blocks];
            newBlocks[index].mode = newMode;
            newBlocks[index].points = initialPoints.map((p) => ({ ...p, x: "" }));
            newBlocks[index].kerogenValue = "";
            newBlocks[index].analysisResult = null;
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
          onAnalyze={(sampleType, measurements, kerogenMeasurement) =>
            handleAnalyze(index, sampleType, measurements, kerogenMeasurement)
          }
          onClearResult={() => handleClearResult(index)}
        />
      ))}

      {isManySamplesMode && manySamplesResult.length > 0 && (
        <div
          style={{
            width: "100%",
            marginTop: 20,
            backgroundColor: "white",
            borderRadius: 15,
            padding: 20
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Таблица результата (result_df)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                {Object.keys(manySamplesResult[0]).map((key) => (
                  <th
                    key={key}
                    style={{
                      textAlign: "left",
                      padding: "10px 8px",
                      borderBottom: "2px solid #e0e0e0",
                      backgroundColor: "#f8fafc",
                      fontSize: 14,
                      wordBreak: "break-word"
                    }}
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {manySamplesResult.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: row.is_outlier ? "#ffebee" : "white" }}>
                  {Object.keys(manySamplesResult[0]).map((key) => (
                    <td
                      key={`${idx}-${key}`}
                      style={{
                        padding: "8px",
                        borderBottom: "1px solid #f0f0f0",
                        fontSize: 13,
                        wordBreak: "break-word"
                      }}
                    >
                      {String(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DynamicCategoryChart;
