import React from 'react'
import './App.css'

const activityMultipliers = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
}

const macroByGoal = {
  lose: { protein: 35, carbs: 35, fat: 30 },
  maintain: { protein: 30, carbs: 40, fat: 30 },
  gain: { protein: 30, carbs: 45, fat: 25 },
}

function cmToFeetInches(cm) {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return { feet, inches }
}

function feetInchesToCm(feet, inches) {
  return (feet * 12 + inches) * 2.54
}

function kgToLbs(kg) {
  return kg * 2.2046226218
}

function lbsToKg(lbs) {
  return lbs * 0.45359237
}

function getBmi(weightKg, heightCm) {
  const heightM = heightCm / 100
  if (heightM <= 0) return 0
  return weightKg / (heightM * heightM)
}

function getCategory(bmi) {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

function getCategoryTone(category) {
  if (category === 'Underweight') return 'tone-blue'
  if (category === 'Normal') return 'tone-green'
  if (category === 'Overweight') return 'tone-yellow'
  return 'tone-red'
}

function getWeightRecommendation(weightKg, heightCm, category) {
  const heightM = heightCm / 100
  const minWeight = 18.5 * heightM * heightM
  const maxWeight = 24.9 * heightM * heightM
  const targetWeight = (minWeight + maxWeight) / 2

  let delta = 0
  let direction = 'maintain'

  if (category === 'Underweight') {
    delta = Math.max(0, minWeight - weightKg)
    direction = 'gain'
  } else if (category === 'Overweight' || category === 'Obese') {
    delta = Math.max(0, weightKg - maxWeight)
    direction = 'lose'
  }

  return {
    minWeight,
    maxWeight,
    targetWeight,
    delta,
    direction,
  }
}

function calculateBmr({ gender, age, weightKg, heightCm }) {
  if (gender === 'female') return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
}

function buildAiPrompt({ user, metrics }) {
  return `You are a certified nutritionist and fitness coach. Generate a concise, practical plan in strict JSON only.

Output schema:
{
  "assessment": "3-4 sentence personalized health assessment",
  "mealPlan": {
    "breakfast": ["item1", "item2"],
    "lunch": ["item1", "item2"],
    "dinner": ["item1", "item2"],
    "snacks": ["item1", "item2"]
  },
  "calories": {
    "dailyTarget": "number in kcal",
    "macroSplit": {
      "protein": "percent",
      "carbs": "percent",
      "fat": "percent"
    },
    "explanation": "1-2 sentence rationale"
  },
  "tips": ["tip1", "tip2", "tip3", "tip4", "tip5", "tip6"]
}

User profile:
- Age: ${user.age}
- Gender: ${user.gender}
- Height(cm): ${metrics.heightCm.toFixed(1)}
- Weight(kg): ${metrics.weightKg.toFixed(1)}
- BMI: ${metrics.bmi.toFixed(1)}
- BMI Category: ${metrics.category}
- Activity Level: ${user.activityLevel}
- Health Goal: ${user.healthGoal}
- Diet Preference: ${user.dietPreference}
- Estimated TDEE: ${Math.round(metrics.tdee)} kcal
- Suggested calorie target: ${Math.round(metrics.calorieTarget)} kcal
- Suggested macro split: Protein ${metrics.macroSplit.protein}%, Carbs ${metrics.macroSplit.carbs}%, Fat ${metrics.macroSplit.fat}%

Important rules:
- Keep advice realistic and culturally neutral.
- Match meals to diet preference strictly.
- Keep tips actionable and specific.
- Return JSON only; no markdown fences, no extra text.`
}

function parseAiResponse(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  return {
    assessment: parsed.assessment || '',
    mealPlan: {
      breakfast: parsed.mealPlan?.breakfast || [],
      lunch: parsed.mealPlan?.lunch || [],
      dinner: parsed.mealPlan?.dinner || [],
      snacks: parsed.mealPlan?.snacks || [],
    },
    calories: {
      dailyTarget:
        parsed.calories?.dailyTarget !== undefined
          ? parsed.calories.dailyTarget
          : '',
      macroSplit: {
        protein: parsed.calories?.macroSplit?.protein ?? '',
        carbs: parsed.calories?.macroSplit?.carbs ?? '',
        fat: parsed.calories?.macroSplit?.fat ?? '',
      },
      explanation: parsed.calories?.explanation || '',
    },
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
  }
}

function sanitizeEnvValue(value) {
  return String(value || '')
    .trim()
    .replace(/^['\"]|['\"]$/g, '')
}

async function fetchAiDietPlan({ user, metrics }) {
  const apiKey = sanitizeEnvValue(import.meta.env.VITE_GROQ_API_KEY)
  const model = sanitizeEnvValue(import.meta.env.VITE_GROQ_MODEL) || 'llama-3.3-70b-versatile'

  if (!apiKey) {
    throw new Error(
      'Missing VITE_GROQ_API_KEY. Add it in your .env file to enable Groq API calls.',
    )
  }

  if (!apiKey.startsWith('gsk_')) {
    throw new Error('Invalid Groq key format. Expected a key that starts with gsk_.')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON nutrition-planning assistant. Return valid JSON only.',
        },
        {
          role: 'user',
          content: buildAiPrompt({ user, metrics }),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    if (response.status === 401) {
      throw new Error(
        'Groq API failed (401): Invalid API key. Check VITE_GROQ_API_KEY, remove quotes/spaces, and restart the Vite dev server.',
      )
    }
    throw new Error(`Groq API failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''

  if (!text) {
    throw new Error('Groq returned an empty response.')
  }

  return parseAiResponse(text)
}

const App = () => {
  const [form, setForm] = React.useState({
    age: 27,
    gender: 'male',
    unitSystem: 'metric',
    heightCm: 170,
    heightFt: 5,
    heightIn: 7,
    weightKg: 70,
    weightLb: 154,
    activityLevel: 'moderate',
    healthGoal: 'maintain',
    dietPreference: 'balanced',
  })
  const [result, setResult] = React.useState(null)
  const [isLoadingPlan, setIsLoadingPlan] = React.useState(false)
  const [aiPlan, setAiPlan] = React.useState(null)
  const [error, setError] = React.useState('')

  const markerPosition = result
    ? Math.max(0, Math.min(100, ((result.bmi - 12) / 28) * 100))
    : 0

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleUnitSystem(nextSystem) {
    setForm((prev) => {
      if (nextSystem === prev.unitSystem) return prev

      if (nextSystem === 'imperial') {
        const { feet, inches } = cmToFeetInches(prev.heightCm)
        return {
          ...prev,
          unitSystem: 'imperial',
          heightFt: feet,
          heightIn: inches,
          weightLb: Math.round(kgToLbs(prev.weightKg)),
        }
      }

      return {
        ...prev,
        unitSystem: 'metric',
        heightCm: Math.round(feetInchesToCm(prev.heightFt, prev.heightIn)),
        weightKg: Math.round(lbsToKg(prev.weightLb)),
      }
    })
  }

  function getComputedMetrics() {
    const heightCm =
      form.unitSystem === 'metric'
        ? Number(form.heightCm)
        : feetInchesToCm(Number(form.heightFt), Number(form.heightIn))

    const weightKg =
      form.unitSystem === 'metric'
        ? Number(form.weightKg)
        : lbsToKg(Number(form.weightLb))

    const bmi = getBmi(weightKg, heightCm)
    const category = getCategory(bmi)
    const recommendation = getWeightRecommendation(weightKg, heightCm, category)

    const bmr = calculateBmr({
      gender: form.gender,
      age: Number(form.age),
      weightKg,
      heightCm,
    })
    const tdee = bmr * activityMultipliers[form.activityLevel]
    const calorieAdjust = form.healthGoal === 'lose' ? -450 : form.healthGoal === 'gain' ? 350 : 0
    const calorieTarget = tdee + calorieAdjust
    const macroSplit = macroByGoal[form.healthGoal]

    return {
      bmi,
      category,
      heightCm,
      weightKg,
      recommendation,
      tdee,
      calorieTarget,
      macroSplit,
    }
  }

  function getMessage(metrics) {
    const { recommendation } = metrics
    const roundedDelta = recommendation.delta.toFixed(1)

    if (recommendation.direction === 'lose') {
      return `You are ${roundedDelta} kg above your ideal range. Gradual loss of 0.5 kg/week is recommended.`
    }
    if (recommendation.direction === 'gain') {
      return `You are ${roundedDelta} kg below your ideal range. Gradual gain of 0.25-0.5 kg/week is recommended.`
    }
    return 'You are currently within your ideal weight range. Focus on consistency to maintain your progress.'
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setAiPlan(null)

    const metrics = getComputedMetrics()
    setResult(metrics)

    setIsLoadingPlan(true)
    try {
      const plan = await fetchAiDietPlan({ user: form, metrics })
      setAiPlan(plan)
    } catch (err) {
      setError(err.message || 'Unable to generate AI plan right now.')
    } finally {
      setIsLoadingPlan(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="grid-overlay" aria-hidden="true" />
      <section className="card form-card fade-up">
        <p className="kicker">AI Health Dashboard</p>
        <h1>BMI Calculator + Diet Planner</h1>
        <p className="subtext">
          Fill your profile and get BMI insights, weight recommendation, and an
          AI-generated meal plan.
        </p>

        <div className="unit-toggle" role="radiogroup" aria-label="Unit system">
          <button
            type="button"
            className={form.unitSystem === 'metric' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => toggleUnitSystem('metric')}
          >
            Metric
          </button>
          <button
            type="button"
            className={
              form.unitSystem === 'imperial' ? 'toggle-btn active' : 'toggle-btn'
            }
            onClick={() => toggleUnitSystem('imperial')}
          >
            Imperial
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Age
            <input
              type="number"
              min={10}
              max={100}
              value={form.age}
              onChange={(event) => updateField('age', Number(event.target.value))}
              required
            />
          </label>

          <label>
            Gender
            <select
              value={form.gender}
              onChange={(event) => updateField('gender', event.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          {form.unitSystem === 'metric' ? (
            <>
              <label>
                Height (cm)
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={form.heightCm}
                  onChange={(event) =>
                    updateField('heightCm', Number(event.target.value))
                  }
                  required
                />
              </label>
              <label>
                Weight (kg)
                <input
                  type="number"
                  min={30}
                  max={250}
                  value={form.weightKg}
                  onChange={(event) =>
                    updateField('weightKg', Number(event.target.value))
                  }
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Height (ft)
                <input
                  type="number"
                  min={3}
                  max={8}
                  value={form.heightFt}
                  onChange={(event) =>
                    updateField('heightFt', Number(event.target.value))
                  }
                  required
                />
              </label>
              <label>
                Height (in)
                <input
                  type="number"
                  min={0}
                  max={11}
                  value={form.heightIn}
                  onChange={(event) =>
                    updateField('heightIn', Number(event.target.value))
                  }
                  required
                />
              </label>
              <label>
                Weight (lbs)
                <input
                  type="number"
                  min={66}
                  max={550}
                  value={form.weightLb}
                  onChange={(event) =>
                    updateField('weightLb', Number(event.target.value))
                  }
                  required
                />
              </label>
            </>
          )}

          <label>
            Activity Level
            <select
              value={form.activityLevel}
              onChange={(event) => updateField('activityLevel', event.target.value)}
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Lightly Active</option>
              <option value="moderate">Moderately Active</option>
              <option value="active">Active</option>
              <option value="veryActive">Very Active</option>
            </select>
          </label>

          <label>
            Health Goal
            <select
              value={form.healthGoal}
              onChange={(event) => updateField('healthGoal', event.target.value)}
            >
              <option value="lose">Lose</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain</option>
            </select>
          </label>

          <label>
            Diet Preference
            <select
              value={form.dietPreference}
              onChange={(event) => updateField('dietPreference', event.target.value)}
            >
              <option value="balanced">Balanced</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="keto">Keto</option>
              <option value="mediterranean">Mediterranean</option>
              <option value="high-protein">High-Protein</option>
            </select>
          </label>

          <button className="primary-btn" type="submit">
            Calculate & Get AI Plan
          </button>
        </form>
      </section>

      {result && (
        <section className="card fade-up">
          <div className="result-header">
            <h2>BMI Result</h2>
            <span className={`status-badge ${getCategoryTone(result.category)}`}>
              {result.category}
            </span>
          </div>
          <p className="bmi-number">{result.bmi.toFixed(1)}</p>

          <div className="bmi-scale" role="img" aria-label="BMI gradient scale">
            <div className="scale-bar" />
            <div className="scale-marker" style={{ left: `${markerPosition}%` }} />
          </div>
          <div className="scale-labels">
            <span>Under</span>
            <span>Normal</span>
            <span>Over</span>
            <span>Obese</span>
          </div>
        </section>
      )}

      {result && (
        <section className="card fade-up">
          <h2>Weight Recommendation</h2>
          <div className="stat-grid">
            <article className={`stat-card ${getCategoryTone(result.category)}`}>
              <p>Ideal Weight Range</p>
              <strong>
                {result.recommendation.minWeight.toFixed(1)} -{' '}
                {result.recommendation.maxWeight.toFixed(1)} kg
              </strong>
            </article>
            <article className={`stat-card ${getCategoryTone(result.category)}`}>
              <p>Weight to Lose/Gain</p>
              <strong>
                {result.recommendation.direction === 'maintain'
                  ? '0.0 kg'
                  : `${result.recommendation.delta.toFixed(1)} kg (${result.recommendation.direction})`}
              </strong>
            </article>
            <article className={`stat-card ${getCategoryTone(result.category)}`}>
              <p>Healthy Target Weight</p>
              <strong>{result.recommendation.targetWeight.toFixed(1)} kg</strong>
            </article>
          </div>
          <p className="message">{getMessage(result)}</p>
        </section>
      )}

      {isLoadingPlan && (
        <section className="card loading-card fade-up" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Generating your AI diet plan with Groq...</p>
        </section>
      )}

      {error && (
        <section className="card error-card fade-up">
          <p>{error}</p>
        </section>
      )}

      {aiPlan && !isLoadingPlan && (
        <section className="card fade-up">
          <h2>AI Diet Plan</h2>

          <div className="ai-section">
            <h3>Health Assessment</h3>
            <p>{aiPlan.assessment}</p>
          </div>

          <div className="ai-section">
            <h3>Meal Plan</h3>
            <div className="meal-grid">
              {Object.entries(aiPlan.mealPlan).map(([mealType, items]) => (
                <article key={mealType} className="meal-card">
                  <h4>{mealType}</h4>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="ai-section">
            <h3>Daily Calorie Target</h3>
            <p className="calorie-target">{aiPlan.calories.dailyTarget} kcal</p>
            <p>
              Protein: {aiPlan.calories.macroSplit.protein}% | Carbs:{' '}
              {aiPlan.calories.macroSplit.carbs}% | Fat:{' '}
              {aiPlan.calories.macroSplit.fat}%
            </p>
            <p>{aiPlan.calories.explanation}</p>
          </div>

          <div className="ai-section">
            <h3>Lifestyle Tips</h3>
            <div className="tips-wrap">
              {aiPlan.tips.map((tip) => (
                <span key={tip} className="tip-pill">
                  {tip}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App