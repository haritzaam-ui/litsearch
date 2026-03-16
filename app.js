import { useState, useRef, useEffect, createElement as h } from "react";
import { createRoot } from "react-dom/client";

const SEARCH_STATES = {
  IDLE: "idle",
  SEARCHING: "searching",
  DONE: "done",
  ERROR: "error",
};

const STUDY_TYPES = [
  "Any",
  "Cross-sectional",
  "Cohort",
  "Case-control",
  "RCT",
  "Systematic Review",
  "Meta-analysis",
  "Qualitative",
  "Mixed Methods",
  "Quasi-experimental",
];

const LANGUAGES = ["English", "Indonesian", "Any"];

const LOADING_MESSAGES = [
  "Scanning the academic horizon...",
  "Cross-referencing databases...",
  "Extracting key findings...",
  "Building your literature matrix...",
];

function parseResultsFromText(text) {
  const jsonMatch = text.match(/\[[\s\S]*?\{[\s\S]*?"author"[\s\S]*?\}[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {}
  }
  const objects = [];
  const objRegex = /\{[^{}]*"author"[^{}]*\}/g;
  let match;
  while ((match = objRegex.exec(text)) !== null) {
    try {
      objects.push(JSON.parse(match[0]));
    } catch (e) {
      continue;
    }
  }
  if (objects.length > 0) return objects;
  return null;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function resultsToCSV(results) {
  if (!results || results.length === 0) return "";
  const headers = ["No", "Author(s)", "Year", "Title", "Study Design", "Sample", "Key Findings", "Limitations", "Source"];
  const rows = results.map((r, i) => [
    i + 1,
    `"${(r.author || "").replace(/"/g, '""')}"`,
    r.year || "",
    `"${(r.title || "").replace(/"/g, '""')}"`,
    `"${(r.design || "").replace(/"/g, '""')}"`,
    `"${(r.sample || "").replace(/"/g, '""')}"`,
    `"${(r.findings || "").replace(/"/g, '""')}"`,
    `"${(r.limitations || "").replace(/"/g, '""')}"`,
    `"${(r.source || "").replace(/"/g, '""')}"`,
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function PulseOrb({ active }) {
  return h("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: active ? "#34d399" : "#475569",
      boxShadow: active ? "0 0 12px #34d39966" : "none",
      transition: "all 0.6s ease",
      animation: active ? "pulse 1.8s ease-in-out infinite" : "none",
    },
  });
}

function InputField({ label, value, onChange, placeholder, type = "text", mono = false }) {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
    h("label", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#94a3b8",
        fontFamily: "'DM Mono', monospace",
      },
    }, label),
    h("input", {
      type,
      value,
      onChange: (e) => onChange(e.target.value),
      placeholder,
      style: {
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: "10px 14px",
        color: "#e2e8f0",
        fontSize: 14,
        fontFamily: mono ? "'DM Mono', monospace" : "'Source Serif 4', Georgia, serif",
        outline: "none",
        transition: "border-color 0.2s",
      },
      onFocus: (e) => (e.target.style.borderColor = "#34d399"),
      onBlur: (e) => (e.target.style.borderColor = "#1e293b"),
    })
  );
}

function SelectField({ label, value, onChange, options }) {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
    h("label", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#94a3b8",
        fontFamily: "'DM Mono', monospace",
      },
    }, label),
    h("select", {
      value,
      onChange: (e) => onChange(e.target.value),
      style: {
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: "10px 14px",
        color: "#e2e8f0",
        fontSize: 14,
        fontFamily: "'DM Mono', monospace",
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      },
    }, ...options.map((opt) => h("option", { key: opt, value: opt }, opt)))
  );
}

const cellStyle = {
  padding: "10px 14px",
  borderBottom: "1px solid #1e293b22",
  color: "#cbd5e1",
  verticalAlign: "top",
};

function ResultsTable({ results }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  if (!results || results.length === 0) return null;

  return h("div", {
    style: {
      overflowX: "auto",
      borderRadius: 12,
      border: "1px solid #1e293b",
      background: "#0a0f1a",
    },
  },
    h("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13,
        fontFamily: "'Source Serif 4', Georgia, serif",
      },
    },
      h("thead", null,
        h("tr", null,
          ...["#", "Author(s)", "Year", "Title", "Design", "Sample", "Key Findings", "Limitations", ""].map(
            (header, i) => h("th", {
              key: i,
              style: {
                padding: "12px 14px",
                textAlign: "left",
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#34d399",
                borderBottom: "2px solid #1e293b",
                whiteSpace: "nowrap",
                position: "sticky",
                top: 0,
                background: "#0a0f1a",
                zIndex: 1,
              },
            }, header)
          )
        )
      ),
      h("tbody", null,
        ...results.map((r, idx) =>
          h("tr", {
            key: idx,
            onMouseEnter: () => setHoveredRow(idx),
            onMouseLeave: () => setHoveredRow(null),
            style: {
              background: hoveredRow === idx ? "#111827" : "transparent",
              transition: "background 0.15s",
            },
          },
            h("td", { style: cellStyle }, idx + 1),
            h("td", { style: { ...cellStyle, fontWeight: 600, minWidth: 120 } }, r.author || "\u2014"),
            h("td", { style: { ...cellStyle, fontFamily: "'DM Mono', monospace", fontSize: 12 } }, r.year || "\u2014"),
            h("td", { style: { ...cellStyle, minWidth: 200, maxWidth: 280 } }, r.title || "\u2014"),
            h("td", { style: cellStyle },
              h("span", {
                style: {
                  background: "#1e293b",
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                  color: "#94a3b8",
                  whiteSpace: "nowrap",
                },
              }, r.design || "\u2014")
            ),
            h("td", { style: { ...cellStyle, fontFamily: "'DM Mono', monospace", fontSize: 12 } }, r.sample || "\u2014"),
            h("td", { style: { ...cellStyle, minWidth: 200, maxWidth: 320, lineHeight: 1.5 } }, r.findings || "\u2014"),
            h("td", { style: { ...cellStyle, minWidth: 140, maxWidth: 240, color: "#f59e0b", lineHeight: 1.5 } }, r.limitations || "\u2014"),
            h("td", { style: cellStyle },
              h("button", {
                onClick: () => {
                  const citation = `${r.author} (${r.year}). ${r.title}.`;
                  copyToClipboard(citation);
                  setCopiedIdx(idx);
                  setTimeout(() => setCopiedIdx(null), 1500);
                },
                title: "Copy citation",
                style: {
                  background: copiedIdx === idx ? "#34d399" : "#1e293b",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: copiedIdx === idx ? "#0a0f1a" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "'DM Mono', monospace",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                },
              }, copiedIdx === idx ? "Copied!" : "Cite")
            )
          )
        )
      )
    )
  );
}

function RawTextResult({ text }) {
  return h("div", {
    style: {
      background: "#0a0f1a",
      border: "1px solid #1e293b",
      borderRadius: 12,
      padding: 24,
      color: "#cbd5e1",
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: 14,
      lineHeight: 1.7,
      whiteSpace: "pre-wrap",
      maxHeight: 500,
      overflowY: "auto",
    },
  }, text);
}

function LiteratureSearchEngine() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("litsearch_api_key") || "");
  const [showKey, setShowKey] = useState(false);
  const [topic, setTopic] = useState("");
  const [studyType, setStudyType] = useState("Any");
  const [yearFrom, setYearFrom] = useState("2019");
  const [yearTo, setYearTo] = useState("2025");
  const [language, setLanguage] = useState("English");
  const [maxResults, setMaxResults] = useState("10");
  const [additionalCriteria, setAdditionalCriteria] = useState("");
  const [status, setStatus] = useState(SEARCH_STATES.IDLE);
  const [results, setResults] = useState(null);
  const [rawText, setRawText] = useState("");
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [searchCount, setSearchCount] = useState(0);
  const [csvCopied, setCsvCopied] = useState(false);
  const loadingInterval = useRef(null);

  useEffect(() => {
    if (apiKey) localStorage.setItem("litsearch_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (status === SEARCH_STATES.SEARCHING) {
      let i = 0;
      loadingInterval.current = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
      }, 2800);
    } else {
      clearInterval(loadingInterval.current);
    }
    return () => clearInterval(loadingInterval.current);
  }, [status]);

  async function handleSearch() {
    if (!topic.trim() || !apiKey.trim()) return;
    setStatus(SEARCH_STATES.SEARCHING);
    setResults(null);
    setRawText("");

    const studyFilter = studyType !== "Any" ? `Study type filter: ${studyType} studies only.` : "";
    const langFilter = language !== "Any" ? `Prefer ${language} language articles.` : "";
    const extra = additionalCriteria.trim() ? `Additional criteria: ${additionalCriteria}` : "";

    const prompt = `You are an academic research assistant specializing in medical and dental sciences. Search the web for peer-reviewed research articles on the following topic and return structured results.

Topic: "${topic}"
${studyFilter}
Date range: ${yearFrom}\u2013${yearTo}
${langFilter}
Maximum results: ${maxResults}
${extra}

IMPORTANT: Return ONLY a JSON array with NO additional text, no markdown, no code fences. Each object in the array must have these exact keys:
- "author": first author et al. format (e.g., "Smith et al.")
- "year": publication year as string
- "title": full article title
- "design": study design type (e.g., "Cross-sectional", "RCT", "Systematic Review")
- "sample": sample size and population (e.g., "n=200 outpatients")
- "findings": 1-2 sentence summary of key findings
- "limitations": main limitation noted
- "source": journal name or DOI if available

Search thoroughly using academic and scientific sources. Prioritize PubMed-indexed, Scopus-indexed, and reputable journal articles. Return real, verifiable studies only.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "API error");
      }

      const fullText = data.content
        .map((item) => {
          if (item.type === "text") return item.text;
          return "";
        })
        .filter(Boolean)
        .join("\n");

      const parsed = parseResultsFromText(fullText);
      if (parsed && parsed.length > 0) {
        setResults(parsed);
      } else {
        setRawText(fullText || "No results found. Try broadening your search criteria.");
      }
      setStatus(SEARCH_STATES.DONE);
      setSearchCount((c) => c + 1);
    } catch (err) {
      setRawText(`Search failed: ${err.message}. Please try again.`);
      setStatus(SEARCH_STATES.ERROR);
    }
  }

  function handleExportCSV() {
    if (!results) return;
    const csv = resultsToCSV(results);
    copyToClipboard(csv);
    setCsvCopied(true);
    setTimeout(() => setCsvCopied(false), 2000);
  }

  return h("div", {
    style: {
      minHeight: "100vh",
      background: "#060a14",
      color: "#e2e8f0",
      fontFamily: "'Source Serif 4', Georgia, serif",
      position: "relative",
      overflow: "hidden",
    },
  },
    // Ambient backgrounds
    h("div", {
      style: {
        position: "fixed",
        top: "-30%",
        right: "-20%",
        width: 800,
        height: 800,
        borderRadius: "50%",
        background: "radial-gradient(circle, #34d39908 0%, transparent 70%)",
        pointerEvents: "none",
      },
    }),
    h("div", {
      style: {
        position: "fixed",
        bottom: "-40%",
        left: "-10%",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, #0ea5e908 0%, transparent 70%)",
        pointerEvents: "none",
      },
    }),
    // Global styles
    h("style", null, `
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap');
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.2); }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #334155; }
    `),
    // Main content
    h("div", {
      style: { maxWidth: 1100, margin: "0 auto", padding: "40px 24px 60px", position: "relative" },
    },
      // Header
      h("div", {
        style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 8 },
      },
        h(PulseOrb, { active: status === SEARCH_STATES.SEARCHING }),
        h("h1", {
          style: {
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #34d399, #0ea5e9)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          },
        }, "LitSearch"),
        h("span", {
          style: {
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "#475569",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: 4,
          },
        }, "Academic Literature Engine")
      ),
      h("p", {
        style: {
          color: "#64748b",
          fontSize: 14,
          marginBottom: 32,
          marginLeft: 26,
          fontStyle: "italic",
        },
      }, "AI-powered research article discovery for medical & dental sciences"),

      // Search Form
      h("div", {
        style: {
          background: "#0d1117",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 28,
          marginBottom: 28,
          animation: "slideUp 0.5s ease-out",
        },
      },
        // API Key field
        h("div", { style: { marginBottom: 20 } },
          h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
            h("label", {
              style: {
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94a3b8",
                fontFamily: "'DM Mono', monospace",
              },
            }, "Anthropic API Key"),
            h("div", { style: { display: "flex", gap: 8 } },
              h("input", {
                type: showKey ? "text" : "password",
                value: apiKey,
                onChange: (e) => setApiKey(e.target.value),
                placeholder: "sk-ant-...",
                style: {
                  flex: 1,
                  background: "#0f172a",
                  border: `1px solid ${apiKey.trim() ? "#1e293b" : "#ef444466"}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#e2e8f0",
                  fontSize: 14,
                  fontFamily: "'DM Mono', monospace",
                  outline: "none",
                  transition: "border-color 0.2s",
                },
                onFocus: (e) => (e.target.style.borderColor = "#34d399"),
                onBlur: (e) => (e.target.style.borderColor = apiKey.trim() ? "#1e293b" : "#ef444466"),
              }),
              h("button", {
                onClick: () => setShowKey(!showKey),
                style: {
                  background: "#1e293b",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontFamily: "'DM Mono', monospace",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                },
              }, showKey ? "Hide" : "Show")
            ),
            h("span", {
              style: {
                fontSize: 10,
                color: "#475569",
                fontFamily: "'DM Mono', monospace",
              },
            }, "Stored locally in your browser. Never sent anywhere except Anthropic's API.")
          )
        ),

        // Topic
        h("div", { style: { marginBottom: 20 } },
          h(InputField, {
            label: "Research Topic",
            value: topic,
            onChange: setTopic,
            placeholder: 'e.g., "patient satisfaction outpatient pharmacy services SERVQUAL"',
          })
        ),

        // Grid of parameters
        h("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 20,
          },
        },
          h(SelectField, { label: "Study Design", value: studyType, onChange: setStudyType, options: STUDY_TYPES }),
          h(InputField, { label: "Year From", value: yearFrom, onChange: setYearFrom, placeholder: "2019", mono: true }),
          h(InputField, { label: "Year To", value: yearTo, onChange: setYearTo, placeholder: "2025", mono: true }),
          h(SelectField, { label: "Language", value: language, onChange: setLanguage, options: LANGUAGES }),
          h(InputField, { label: "Max Results", value: maxResults, onChange: setMaxResults, placeholder: "10", mono: true })
        ),

        // Additional criteria
        h("div", { style: { marginBottom: 24 } },
          h(InputField, {
            label: "Additional Criteria (optional)",
            value: additionalCriteria,
            onChange: setAdditionalCriteria,
            placeholder: 'e.g., "hospital pharmacy setting, developing countries, Likert scale instruments"',
          })
        ),

        // Search button
        h("button", {
          onClick: handleSearch,
          disabled: status === SEARCH_STATES.SEARCHING || !topic.trim() || !apiKey.trim(),
          style: {
            width: "100%",
            padding: "14px 24px",
            background:
              status === SEARCH_STATES.SEARCHING
                ? "linear-gradient(90deg, #1e293b, #334155, #1e293b)"
                : !topic.trim() || !apiKey.trim()
                ? "#1e293b"
                : "linear-gradient(135deg, #059669, #0d9488)",
            backgroundSize: status === SEARCH_STATES.SEARCHING ? "200% 100%" : "100% 100%",
            animation: status === SEARCH_STATES.SEARCHING ? "shimmer 2s linear infinite" : "none",
            border: "none",
            borderRadius: 10,
            color: !topic.trim() || !apiKey.trim() ? "#475569" : "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.05em",
            cursor: status === SEARCH_STATES.SEARCHING || !topic.trim() || !apiKey.trim() ? "not-allowed" : "pointer",
            transition: "all 0.3s",
          },
        }, status === SEARCH_STATES.SEARCHING
          ? loadingMsg
          : !apiKey.trim()
          ? "Enter API Key to Search"
          : "Search Literature")
      ),

      // Results area
      status === SEARCH_STATES.DONE && h("div", { style: { animation: "slideUp 0.5s ease-out" } },
        h("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          },
        },
          h("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
            h("h2", {
              style: { fontSize: 18, fontWeight: 600, margin: 0, color: "#e2e8f0" },
            }, "Results"),
            results && h("span", {
              style: {
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "#34d399",
                background: "#34d39915",
                padding: "3px 10px",
                borderRadius: 20,
              },
            }, `${results.length} articles found`)
          ),
          results && h("button", {
            onClick: handleExportCSV,
            style: {
              background: csvCopied ? "#34d399" : "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "8px 16px",
              color: csvCopied ? "#0a0f1a" : "#94a3b8",
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              cursor: "pointer",
              transition: "all 0.2s",
            },
          }, csvCopied ? "CSV Copied!" : "Copy as CSV")
        ),
        results ? h(ResultsTable, { results }) : h(RawTextResult, { text: rawText })
      ),

      status === SEARCH_STATES.ERROR && h("div", { style: { animation: "slideUp 0.4s ease-out" } },
        h(RawTextResult, { text: rawText })
      ),

      // Footer
      h("div", {
        style: {
          marginTop: 48,
          paddingTop: 20,
          borderTop: "1px solid #1e293b22",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
        h("span", {
          style: {
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "#334155",
            letterSpacing: "0.05em",
          },
        }, "Powered by Claude API + Web Search"),
        h("span", {
          style: {
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "#334155",
          },
        }, searchCount > 0 ? `${searchCount} search${searchCount > 1 ? "es" : ""} this session` : "")
      )
    )
  );
}

createRoot(document.getElementById("root")).render(h(LiteratureSearchEngine));
