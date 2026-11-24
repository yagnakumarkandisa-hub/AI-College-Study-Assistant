# AI College Study Assistant

A full-stack academic study assistant built with React, TypeScript, Express, SQLite, PDF.js, and the Google Gemini API.

## Features

- **Student Authentication & Private Vault**: Registration, login, logout, salted `scrypt` password hashing, and per-user data isolation in SQLite (`instance/study_assistant.db`).
- **PDF Upload & Validation**: Multi-PDF upload (up to 15 MB per file), `%PDF-` header validation, corrupted/empty/scanned PDF detection (OCR notice), and page-by-page extracted text preview.
- **RAG-Grounded AI Tutor Chat**: Multi-turn subject tutor powered by `gemini-4-hydrogen` and `gemini-embedding-2` chunk retrieval with page citations (`Document · Page X`) and clear separation between note facts and general knowledge.
- **PDF Note Summarizer**: Quick Summary, Detailed Summary, and Exam Preparation Notes with multi-section processing for long documents and one-click copy.
- **MCQ Quiz Generator & Server Grading**: Generate 3–15 four-option questions across Easy, Medium, and Hard difficulty with server-validated scoring, answer explanations, and Try Again mode.
- **Question & Answer Generator**: Important Questions, Short Q&A, Long Q&A, Viva Questions, and Previous-Exam-Style Practice sets organized by topic.
- **Explain Difficult Topics**: Beginner, Step-by-Step, Example-Driven, and Quick Revision modes plus an **Explain Even Simpler** follow-up option.
- **Study Dashboard & History**: Real database-backed metrics, recent quiz scores, and filterable activity history with clear-history support.

## Local Setup (Windows PowerShell)

1. Install Node.js 22+ and open the project folder in Visual Studio Code.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Gemini API key:
   ```powershell
   Copy-Item .env.example .env
   ```
   Edit `.env`:
   ```env
   GEMINI_API_KEY="your_actual_gemini_api_key"
   ```
4. Start the development server on port 3000:
   ```powershell
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

## Production Build

```powershell
npm run build
npm start
```
