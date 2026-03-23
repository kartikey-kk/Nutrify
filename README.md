# Nutrify - AI BMI And Diet Planner

Nutrify is a React app that calculates BMI, shows weight recommendations, and generates an AI-powered diet plan based on your profile.

## Live Demo

https://nutrify-kappa.vercel.app/

## Features

- BMI calculator with metric and imperial support
- BMI category and animated scale marker
- Weight recommendation cards
- AI diet plan generation via Groq API
- Dark, responsive UI

## Tech Stack

- React
- Vite
- Groq API

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create or update `.env`:

```env
VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
VITE_GROQ_MODEL=llama-3.3-70b-versatile
```

3. Start development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Notes

- Restart the dev server after changing `.env`.
- Do not commit real API keys.
