# 🛡️ Data Vetting Agent

A powerful React-based tool for vetting and validating CSV-based scraped data using [Serper API](https://serper.dev). This application helps in assessing the reliability and relevance of content by matching it against Google's search results using the Serper Search API.

## 🔍 Features

- 📁 Import CSV files with scraped web content
- ✅ Automatically validate each row using the Serper API
- 🧠 Assign `approved`, `rejected`, or `pending` status based on content relevance
- 🔄 Filter entries by status
- 📤 Export filtered or full data back to CSV
- 📊 Detailed data review panel for each entry
- 💡 Highlights potential issues and confidence levels

---

## 🧪 Example Use Case

Upload a CSV with scraped website content (title, description, text, etc.), and this app will:

1. Run a validation by forming search queries from content fields.
2. Query Google's search engine via Serper API.
3. Extract keywords from search results and compare them to content.
4. Score and classify the content accordingly.
5. Allow manual review with intuitive UI.

---

## 🏗️ Tech Stack

- ⚛️ **React** with TypeScript
- 🎨 **Tailwind CSS** for styling
- 📦 **PapaParse** for CSV parsing
- 🔎 **Serper.dev** API for validation
- 🧱 **Lucide-react** icons for UI

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/data-vetting-agent.git
cd data-vetting-agent
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file at the root of the project and add your Serper API key:

```bash
VITE_SERPER_API_KEY=your_serper_api_key_here
```

> 🔐 You can get your Serper API key from [https://serper.dev](https://serper.dev)

### 4. Run the App

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📁 CSV Format Guidelines

The CSV should have one or more of the following fields:

* `title`
* `content`
* `description`
* `text`
* `url` (optional but useful)

Each row will be validated and classified accordingly.

---

## 📸 Screenshots

### Dashboard

> ![Displays count of approved, rejected, and pending data](https://github.com/Scorpian1910/Vetting-Agent/blob/main/project/public/assets/VettingAgentImag1.png?raw=true)

### Full Table View

> ![Easily export or manage all data with action buttons.](https://github.com/Scorpian1910/Vetting-Agent/blob/main/project/public/assets/VettingAgentImag2.png?raw=true)

---

## 🔐 API & Security

* Only Serper API key is used (client-side).
* Ensure your API key usage is within free/paid limits.
* **Do not expose sensitive keys in production apps.**

---

## 🛠️ To Do / Improvements

* Add support for Excel (XLSX) file parsing
* Confidence-based color gradients
* Pagination for large data sets
* Backend for secure API key handling

---

## 🤝 Contribution

Contributions, issues, and feature requests are welcome!
Feel free to check [issues page](https://github.com/your-username/data-vetting-agent/issues).

---

## 👨‍💻 Author

**Nagendran Shetty**

Connect with me on [LinkedIn](https://www.linkedin.com/) or check my portfolio for more work.

```


