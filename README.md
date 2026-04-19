# 🎓 VESASC Online Exam Portal

Full-stack online exam application — Node.js + MongoDB + Vanilla JS.
Supports multiple divisions/batches via **Exam Sets**, with per-student question & option shuffling.

---

## 📁 Folder Structure

```
exam-app/
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── models/
│   │   ├── Student.js
│   │   ├── ExamSet.js        ← NEW: paper/division management
│   │   ├── Question.js       ← linked to ExamSet
│   │   └── Result.js         ← stores which ExamSet was attempted
│   ├── routes/
│   │   ├── auth.js
│   │   ├── exam.js           ← shuffling logic here
│   │   └── admin.js          ← full exam set CRUD
│   ├── middleware/auth.js
│   ├── utils/mailer.js
│   └── .env
└── frontend/
    ├── index.html            ← Login
    ├── register.html
    ├── verify-otp.html
    ├── instructions.html
    ├── exam.html             ← Exam interface
    ├── result.html
    ├── img/logo.png          ← VESASC logo
    ├── css/style.css
    └── admin/
        ├── login.html
        ├── dashboard.html    ← Exam Sets management
        └── results.html      ← Filter by set
```

---

## ⚙️ Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure `.env`
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vesasc_exam
JWT_SECRET=your_long_random_secret_here
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 3. Run
```bash
npm start
```
Open `frontend/index.html` or serve with:
```bash
npx serve ../frontend -p 3000
```

---

## 🏫 Multi-Division / Exam Sets Workflow

### For each division/batch:

**Step 1 — Create an Exam Set**
> Admin → Dashboard → Exam Sets → Create New Set
> Enter name (e.g. "Division A — Morning"), duration, negative marking

**Step 2 — Upload Questions**
> Admin → Dashboard → Upload JSON → Select the set → Upload `sample-questions.json`
> OR add questions one by one via Add Question tab

**Step 3 — Activate the Set**
> Click **▶ Activate** on the set card
> ✅ Only ONE set can be active at a time — activating one auto-deactivates others
> Students now get this paper when they log in

**Step 4 — Students Give Exam**
> Students log in → see instructions → take exam → submit
> They get whatever set is currently active — no manual selection needed

**Step 5 — Deactivate / Switch to Next Division**
> After Div A finishes → click **⏸ Deactivate All**
> Create/activate Set B for Div B
> Div A results are preserved and filterable separately

**Step 6 — View Results by Division**
> Admin → Results → Filter by Exam Set dropdown
> Export to CSV per set

---

## 🔀 Shuffling (Anti-Cheating)

Every student gets a **unique arrangement** seeded by their email:

| What's shuffled | How |
|---|---|
| Question order | Seeded by `email + examSetId` |
| Options (A/B/C/D) per question | Seeded by `email + questionId` |

- Two students sitting next to each other see different question orders AND different option positions
- The correct answer is **never sent to the browser** — only the option text is sent
- A mapping (`optionMap`) is stored locally and sent on final submission so the backend can decode and score correctly
- Consistent on page refresh — same student always gets the same shuffle

---

## ⚡ Performance (100+ concurrent users)

- All questions loaded **once** at exam start
- Answers stored in **localStorage** — zero API calls during exam
- **Single POST** on final submission — backend scores everything at once
- MongoDB connection pool: 50
- Stateless JWT — no server sessions
- Nodemailer pooled SMTP connections

---

## 📧 Gmail App Password Setup

1. Google Account → Security → Enable 2-Step Verification
2. Search "App passwords" → Generate for "Mail"
3. Paste the 16-character password into `EMAIL_PASS` in `.env`

---

## 👤 Default Admin Credentials
- Username: `admin`
- Password: `admin123`
(Change in `.env` before going live)
