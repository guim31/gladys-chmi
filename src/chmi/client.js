// -----------------------------------------------------------------------------
// HTTP client of the ČHMÚ open data server (opendata.chmi.cz): plain files,
// no account, no key, read-only GET requests.
//
//   - station metadata, one file a day:      meteorology/climate/now/metadata/
//   - 10-minute observations, one file per station and UTC day, rewritten
//     once an hour:                           meteorology/climate/now/data/
//   - CAP warnings, a full picture of the country at each issue (1.5 to 2 MB):
//                                           meteorology/weather/alerts/cap/
//
// The observation files are read with `If-None-Match`: an unchanged file costs
// a 304 and no body. The URLs never carry the location of the house.
// -----------------------------------------------------------------------------

export const BASE = 'https://opendata.chmi.cz/meteorology';
export const URLS = {
  metadata: `${BASE}/climate/now/metadata`,
  observations: `${BASE}/climate/now/data`,
  cap: `${BASE}/weather/alerts/cap`,
};

/** An answer that is not the expected file: `status` is the HTTP status, if any. */
export class ChmiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ChmiError';
    this.status = status;
  }
}

/** "20261120" for a time, in UTC (the dates of the ČHMÚ file names). */
export const utcDay = (time) => new Date(time).toISOString().slice(0, 10).replaceAll('-', '');

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.userAgent]
 * @param {{ debug: Function }} [options.logger]
 */
export function createChmiClient({
  fetch = globalThis.fetch,
  timeoutMs = 30000,
  userAgent = 'gladys-chmi (+https://github.com/guim31/gladys-chmi)',
  logger,
} = {}) {
  /**
   * @returns {Promise<{ text: string | null, etag: string | null }>} text null on a 304
   */
  async function get(url, { etag } = {}) {
    const where = new URL(url).pathname;
    logger?.debug(`GET ${where}`);
    let response;
    try {
      response = await fetch(url, {
        headers: { 'user-agent': userAgent, ...(etag ? { 'if-none-match': etag } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason =
        err.name === 'TimeoutError' ? `no answer within ${timeoutMs / 1000} s` : err.message;
      throw new ChmiError(`opendata.chmi.cz unreachable (${reason})`);
    }
    if (response.status === 304) {
      return { text: null, etag };
    }
    if (!response.ok) {
      throw new ChmiError(`${where} answered HTTP ${response.status}`, response.status);
    }
    return { text: await response.text(), etag: response.headers.get('etag') };
  }

  async function getJson(url, options) {
    const answer = await get(url, options);
    if (answer.text === null) {
      return answer;
    }
    try {
      return { json: JSON.parse(answer.text), etag: answer.etag };
    } catch {
      throw new ChmiError(`${new URL(url).pathname} answered something that is not JSON`);
    }
  }

  return {
    /** Station list (meta1) and their elements (meta2) of a UTC day. */
    async metadata(day) {
      const [stations, elements] = await Promise.all([
        getJson(`${URLS.metadata}/meta1-${day}.json`),
        getJson(`${URLS.metadata}/meta2-${day}.json`),
      ]);
      return { stations: stations.json, elements: elements.json };
    },

    /** 10-minute observations of a station for a UTC day; `json` absent on a 304. */
    observations: (stationId, day, etag) =>
      getJson(`${URLS.observations}/10m-${stationId}-${day}.json`, { etag }),

    /** The HTML index of the CAP directory. */
    capListing: async () => (await get(`${URLS.cap}/`)).text,

    /** One CAP file, by name. */
    capFile: async (name) => (await get(`${URLS.cap}/${name}`)).text,
  };
}
