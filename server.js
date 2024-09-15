const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: AsiyaMySQL21, // Fix this with process.env instead of plain text
  port: process.env.DB_PORT,
});

async function fetchAndStoreData() {
  let client;
  try {
    const response = await axios.get("https://api.wazirx.com/api/v2/tickers");
    const tickers = Object.values(response.data);

    // Sort tickers by volume in descending order and get top 10
    const top10Tickers = tickers
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, 10);

    console.log("Fetched top 10 tickers:", top10Tickers); // Log fetched data

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("DELETE FROM crypto_data");

    for (const ticker of top10Tickers) {
      await client.query(
        "INSERT INTO crypto_data (name, last, buy, sell, volume, base_unit) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          ticker.name,
          ticker.last,
          ticker.buy,
          ticker.sell,
          ticker.volume,
          ticker.base_unit,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Top 10 results stored successfully");
  } catch (error) {
    console.error("Error fetching or storing data:", error);
    if (client) {
      await client.query("ROLLBACK");
    }
  } finally {
    if (client) client.release();
  }
}

app.get("/api/tickers", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT name, last, buy, sell, volume, base_unit FROM crypto_data ORDER BY volume::float DESC"
    );
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  fetchAndStoreData(); // Initial fetch
  setInterval(fetchAndStoreData, 60000); // Fetch every minute
});
