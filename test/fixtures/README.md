# Test fixtures

Real files of the ČHMÚ open data server (`opendata.chmi.cz`, CC BY 4.0), recorded on 2026-11-20
and trimmed, used by the tests instead of the network.

| File                        | Source                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta1.json`, `meta2.json`  | `meteorology/climate/now/metadata/meta1-20261120.json` and `meta2-…`: stations within 45 km of Prague, plus Cheb, Brno and Reykjavik (a foreign station)  |
| `obs-11514.json`            | `meteorology/climate/now/data/10m-0-203-0-11514-20261120.json` (Praha, Klementinum), from 18:00 UTC                                                       |
| `obs-11522.json`            | The same for 0-203-0-11522 (Neumětely)                                                                                                                    |
| `cap-wind-20261117.xml`     | `meteorology/weather/alerts/cap/alert_cap_50_171002.xml`, issued 2026-11-17: yellow wind warning; geocodes kept for districts 1100, 2101, 2102, 3111 only |
| `cap-heat-20250701.xml`     | `alert_cap_50_010835.xml`, issued 2025-07-01: heat (yellow, orange), fire risk, outlook; same districts kept                                              |
| `cap-listing.html`          | Index of `meteorology/weather/alerts/cap/` on 2026-11-20, a few rows kept                                                                                 |
| `gladys-feature-table.json` | Category/type couples, units and poll frequencies the Gladys core knows (from the core code)                                                              |

The tests re-date the observations to the test clock (`test/helpers/fakeChmi.js`). Scenarios the
recorded CAP files do not cover (new warning, level raised, extension) use CAP files built in the
same layout by `makeCap`. `node scripts/probe.mjs <lat> <lon>` reads the live files.
