package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	_ "github.com/glebarez/go-sqlite"
)

type Fingerprint struct {
	ID           int    `json:"id"`
	Website      string `json:"website"`
	URL          string `json:"url"`
	RiskFile     string `json:"risk_file"`
	Content      string `json:"content"`
	Logic        string `json:"logic"`
	AIAnnotation string `json:"ai_annotation"`
	Version      string `json:"version"`
	Browser      string `json:"browser"`
	CreatedAt    string `json:"created_at"`
}

type Correction struct {
	ID            int    `json:"id"`
	FingerprintID int    `json:"fingerprint_id"`
	ItemKey       string `json:"item_key"`
	Correction    string `json:"correction"`
}

var db *sql.DB

func initDB() {
	var err error
	db, err = sql.Open("sqlite", "fingerprints.db")
	if err != nil {
		log.Fatal(err)
	}

	sqlStmt := `
	CREATE TABLE IF NOT EXISTS fingerprints (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		website TEXT,
		url TEXT,
		risk_file TEXT,
		content TEXT,
		logic TEXT,
		ai_annotation TEXT,
		version TEXT,
		browser TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS corrections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		fingerprint_id INTEGER,
		item_key TEXT,
		correction TEXT,
		FOREIGN KEY(fingerprint_id) REFERENCES fingerprints(id)
	);
	`
	_, err = db.Exec(sqlStmt)
	if err != nil {
		log.Printf("%q: %s\n", err, sqlStmt)
		return
	}

	// Seed data if empty
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM fingerprints").Scan(&count)
	if err == nil && count == 0 {
		seedData := [][]string{
			{"Amazon", "https://www.amazon.com", "sec-sdk-2.4.js", `{"canvas": true, "webgl": "unmasked_renderer"}`, "checkCanvas()", "Canvas指纹检测，用于识别多账号关联风险。", "v2.4.1", "Chrome"},
			{"eBay", "https://www.ebay.com", "ebay-risk-v3.js", `{"fonts": ["Arial", "Helvetica"]}`, "detectFonts()", "通过枚举系统字体列表构建设备画像。", "v3.0.2", "Firefox"},
		}
		for _, data := range seedData {
			_, _ = db.Exec("INSERT INTO fingerprints (website, url, risk_file, content, logic, ai_annotation, version, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7])
		}
	}
}

func main() {
	initDB()
	defer db.Close()

	mux := http.NewServeMux()

	// API Routes
	mux.HandleFunc("/api/fingerprints", handleFingerprints)
	mux.HandleFunc("/api/fingerprints/", handleFingerprintDetail)
	mux.HandleFunc("/api/crawl", handleCrawl)
	mux.HandleFunc("/api/corrections", handleCorrections)

	// Static files
	fs := http.FileServer(http.Dir("dist"))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") {
			return
		}
		path := filepath.Join("dist", r.URL.Path)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.ServeFile(w, r, filepath.Join("dist", "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	})

	port := "3000"
	fmt.Printf("Server running on http://0.0.0.0:%s\n", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, mux))
}

func handleFingerprints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	rows, err := db.Query("SELECT * FROM fingerprints ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var fingerprints []Fingerprint
	for rows.Next() {
		var f Fingerprint
		err := rows.Scan(&f.ID, &f.Website, &f.URL, &f.RiskFile, &f.Content, &f.Logic, &f.AIAnnotation, &f.Version, &f.Browser, &f.CreatedAt)
		if err != nil {
			log.Println(err)
			continue
		}
		fingerprints = append(fingerprints, f)
	}

	var total int
	_ = db.QueryRow("SELECT COUNT(*) FROM fingerprints").Scan(&total)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":       fingerprints,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}

func handleFingerprintDetail(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/fingerprints/")
	id, _ := strconv.Atoi(idStr)

	if r.Method == http.MethodGet {
		var f Fingerprint
		err := db.QueryRow("SELECT * FROM fingerprints WHERE id = ?", id).Scan(&f.ID, &f.Website, &f.URL, &f.RiskFile, &f.Content, &f.Logic, &f.AIAnnotation, &f.Version, &f.Browser, &f.CreatedAt)
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(f)
	} else if r.Method == http.MethodPatch {
		var updates map[string]interface{}
		json.NewDecoder(r.Body).Decode(&updates)
		
		for k, v := range updates {
			_, err := db.Exec(fmt.Sprintf("UPDATE fingerprints SET %s = ? WHERE id = ?", k), v, id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	}
}

func handleCrawl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Results []struct {
			Platform string `json:"platform"`
			Browser  string `json:"browser"`
			URL      string `json:"url"`
			Data     struct {
				RiskFile     string `json:"risk_file"`
				Content      string `json:"content"`
				Logic        string `json:"logic"`
				AIAnnotation string `json:"ai_annotation"`
			} `json:"data"`
		} `json:"results"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	var savedResults []interface{}
	for _, item := range req.Results {
		var lastVersion string
		_ = db.QueryRow("SELECT version FROM fingerprints WHERE website = ? ORDER BY created_at DESC LIMIT 1", item.Platform).Scan(&lastVersion)

		nextVersion := "v1.0.0"
		if lastVersion != "" {
			parts := strings.Split(strings.TrimPrefix(lastVersion, "v"), ".")
			if len(parts) == 3 {
				patch, _ := strconv.Atoi(parts[2])
				nextVersion = fmt.Sprintf("v%s.%s.%d", parts[0], parts[1], patch+1)
			}
		}

		_, err := db.Exec("INSERT INTO fingerprints (website, url, risk_file, content, logic, ai_annotation, version, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			item.Platform, item.URL, item.Data.RiskFile, item.Data.Content, item.Data.Logic, item.Data.AIAnnotation, nextVersion, item.Browser)
		if err != nil {
			log.Println(err)
			continue
		}
		savedResults = append(savedResults, map[string]string{
			"platform": item.Platform,
			"browser":  item.Browser,
			"version":  nextVersion,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "results": savedResults})
}

func handleCorrections(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var c Correction
	json.NewDecoder(r.Body).Decode(&c)

	_, err := db.Exec("INSERT OR REPLACE INTO corrections (fingerprint_id, item_key, correction) VALUES (?, ?, ?)",
		c.FingerprintID, c.ItemKey, c.Correction)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
