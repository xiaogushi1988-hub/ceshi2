import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("fingerprints.db");

async function startServer() {
  // Initialize database
  db.exec(`
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
  `);

  // Add initial mock data if table is empty
  const count = db.prepare("SELECT COUNT(*) as count FROM fingerprints").get() as { count: number };
  console.log(`DEBUG: Current fingerprint count: ${count.count}`);
  
  if (count.count === 0) {
    console.log("DEBUG: Database empty, inserting emergency seed data...");
    const insert = db.prepare(`
      INSERT INTO fingerprints (website, url, risk_file, content, logic, ai_annotation, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seedData = [
      ["Amazon", "https://www.amazon.com", "sec-sdk-2.4.js", '{"canvas": true, "webgl": "unmasked_renderer"}', "checkCanvas()", "Canvas指纹检测，用于识别多账号关联风险。", "v2.4.1"],
      ["eBay", "https://www.ebay.com", "ebay-risk-v3.js", '{"fonts": ["Arial", "Helvetica"]}', "detectFonts()", "通过枚举系统字体列表构建设备画像。", "v3.0.2"],
      ["TikTok Shop", "https://shop.tiktok.com", "tt-risk.js", '{"touch": true, "points": 5}', "checkTouch()", "检测触控点和传感器数据，识别模拟器环境。", "v4.2.0"],
      ["AliExpress", "https://www.aliexpress.com", "ae-guard.js", '{"webrtc": "local_ip"}', "getIPs()", "利用 WebRTC 泄露真实 IP 地址进行地理定位。", "v1.8.9"],
      ["Shopee", "https://shopee.com", "shopee-shield.js", '{"battery": 85}', "getBattery()", "监控电池电量变化作为辅助识别特征。", "v2.1.0"],
      ["System Test", "https://test.ai-studio.com", "test-shield.js", '{"debug": true}', "console.log('active')", "系统测试条目，用于验证检测功能是否正常。", "v1.0.0-SEED"]
    ];

    for (const data of seedData) {
      insert.run(...data);
    }
    console.log("DEBUG: Seed data inserted successfully.");
  }

  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Ensure at least some data exists for the user
  const checkData = db.prepare("SELECT COUNT(*) as count FROM fingerprints").get() as { count: number };
  console.log(`DEBUG: API fingerprints check - total count in DB: ${checkData.count}`);

  app.get("/api/fingerprints", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const rows = db.prepare("SELECT * FROM fingerprints ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    const total = db.prepare("SELECT COUNT(*) as count FROM fingerprints").get() as { count: number };
    
    res.json({
      data: rows,
      total: total.count,
      page,
      limit,
      totalPages: Math.ceil(total.count / limit)
    });
  });

  app.post("/api/crawl", async (req, res) => {
    const { results } = req.body;
    
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: "No results provided" });
    }

    try {
      const savedResults = [];
      for (const item of results) {
        const { platform, browser, data, url } = item;
        
        // Auto-versioning: find latest version for this platform
        const lastRecord = db.prepare("SELECT version FROM fingerprints WHERE website = ? ORDER BY created_at DESC LIMIT 1").get(platform) as { version: string } | undefined;
        
        let nextVersion = "v1.0.0";
        if (lastRecord && lastRecord.version) {
          const match = lastRecord.version.match(/v(\d+)\.(\d+)\.(\d+)/);
          if (match) {
            const [_, major, minor, patch] = match;
            nextVersion = `v${major}.${minor}.${parseInt(patch) + 1}`;
          }
        }

        const stmt = db.prepare(`
          INSERT INTO fingerprints (website, url, risk_file, content, logic, ai_annotation, version, browser)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(platform, url, data.risk_file, data.content, data.logic, data.ai_annotation, nextVersion, browser);
        savedResults.push({ platform, browser, version: nextVersion });
      }

      res.json({ success: true, results: savedResults });
    } catch (error) {
      console.error("Crawl error:", error);
      res.status(500).json({ error: "Failed to save crawl results" });
    }
  });

  app.get("/api/fingerprints/:id", (req, res) => {
    const { id } = req.params;
    const fingerprint = db.prepare("SELECT * FROM fingerprints WHERE id = ?").get(id);
    if (!fingerprint) return res.status(404).json({ error: "Not found" });
    res.json(fingerprint);
  });

  app.post("/api/corrections", (req, res) => {
    const { fingerprint_id, item_key, correction } = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO corrections (fingerprint_id, item_key, correction) VALUES (?, ?, ?)");
    stmt.run(fingerprint_id, item_key, correction);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
