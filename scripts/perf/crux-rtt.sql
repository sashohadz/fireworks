-- How often phone visits are on a slow connection, per European country.
--
-- Source: Chrome UX Report (CrUX), real visits from Chrome users, licensed CC BY 4.0.
--   https://developer.chrome.com/docs/crux/bigquery
-- CrUX groups each visit by the shopper's round trip time (navigator.connection.rtt):
--   low < 75 ms, medium 75 to 275 ms, high 275 ms or more.
-- Lighthouse's Slow 4G sits at the 4G/3G edge (275 ms), so "high" reads as "as slow as Slow 4G or slower".
--
-- Rows are per website (origin), so a country's figure is the average over its websites: all of them,
-- and the most visited ones (rank <= 10000). Fractions are normalised per row.
--
-- Run it in the BigQuery console (https://console.cloud.google.com/bigquery, the free sandbox works),
-- then Save results → JSON (local file), and run: npm run perf:rtt -- <that file>
-- If it returns no rows, the month isn't published yet: use the month before (e.g. 202609).

SELECT
  yyyymm,
  UPPER(country_code) AS country,
  COUNT(*) AS origins,
  COUNTIF(rank <= 10000) AS top_origins,
  ROUND(AVG(SAFE_DIVIDE(low_rtt, low_rtt + medium_rtt + high_rtt)), 4) AS low,
  ROUND(AVG(SAFE_DIVIDE(medium_rtt, low_rtt + medium_rtt + high_rtt)), 4) AS medium,
  ROUND(AVG(SAFE_DIVIDE(high_rtt, low_rtt + medium_rtt + high_rtt)), 4) AS high,
  ROUND(AVG(IF(rank <= 10000, SAFE_DIVIDE(low_rtt, low_rtt + medium_rtt + high_rtt), NULL)), 4) AS top_low,
  ROUND(AVG(IF(rank <= 10000, SAFE_DIVIDE(medium_rtt, low_rtt + medium_rtt + high_rtt), NULL)), 4) AS top_medium,
  ROUND(AVG(IF(rank <= 10000, SAFE_DIVIDE(high_rtt, low_rtt + medium_rtt + high_rtt), NULL)), 4) AS top_high,
  APPROX_QUANTILES(p75_rtt, 2)[OFFSET(1)] AS median_p75_rtt
FROM `chrome-ux-report.materialized.country_summary`
WHERE yyyymm = 202610
  AND device = 'phone'
  AND high_rtt IS NOT NULL
  AND LOWER(country_code) IN (
    'at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie', 'it', 'lv',
    'lt', 'lu', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se', 'gb', 'no', 'ch'
  )
GROUP BY yyyymm, country
ORDER BY country;
